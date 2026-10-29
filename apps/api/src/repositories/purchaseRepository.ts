import type { PoolClient } from 'pg';
import { getPool, query } from '../db';
import type { CreatePurchaseInput, PurchaseListQuery } from '../schemas/purchase';

type PurchaseRow = {
  id: string;
  purchasedOn: string;
  storeName: string | null;
  currency: 'PHP';
  totalPaidCentavos: number;
  createdAt: Date;
};

type PurchaseItemRow = {
  id: string;
  purchaseId: string;
  groceryItemId: string;
  itemName: string;
  quantity: string | number;
  unit: string;
  amountPaidCentavos: number;
};

export type PurchaseRecord = PurchaseRow & {
  items: Array<Omit<PurchaseItemRow, 'purchaseId'>>;
};

async function insertPurchaseItems(
  client: PoolClient,
  purchaseId: string,
  items: CreatePurchaseInput['items']
): Promise<Array<Omit<PurchaseItemRow, 'purchaseId'>>> {
  const insertedItems: Array<Omit<PurchaseItemRow, 'purchaseId'>> = [];

  for (const [position, item] of items.entries()) {
    const result = await client.query<Omit<PurchaseItemRow, 'purchaseId'>>(
      `WITH catalog_item AS (
         INSERT INTO grocery_items (name, normalized_name)
         VALUES (
           btrim(regexp_replace(btrim($3), '[[:space:]]+', ' ', 'g')),
           btrim(regexp_replace(lower(btrim($3)), '[[:space:]]+', ' ', 'g'))
         )
         ON CONFLICT (normalized_name)
         DO UPDATE SET normalized_name = EXCLUDED.normalized_name
         RETURNING id
       )
       INSERT INTO purchase_items (
         purchase_id, position, grocery_item_id, item_name, quantity, unit,
         amount_paid_centavos
       )
       SELECT $1, $2, catalog_item.id, $3, $4, $5, $6
       FROM catalog_item
       RETURNING id, grocery_item_id AS "groceryItemId", item_name AS "itemName", quantity, unit,
                 amount_paid_centavos AS "amountPaidCentavos"`,
      [purchaseId, position, item.itemName, item.quantity, item.unit, item.amountPaidCentavos]
    );
    insertedItems.push(result.rows[0]);
  }

  return insertedItems;
}

export async function createPurchaseRecord(input: CreatePurchaseInput): Promise<PurchaseRecord> {
  const client = await getPool().connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    if (input.storeName) {
      await client.query(
        `INSERT INTO stores (name, normalized_name, category)
         VALUES (
           btrim(regexp_replace($1, '[[:space:]]+', ' ', 'g')),
           btrim(regexp_replace(lower(btrim($1)), '[[:space:]]+', ' ', 'g')),
           'other'
         )
         ON CONFLICT (normalized_name)
         DO UPDATE SET normalized_name = EXCLUDED.normalized_name`,
        [input.storeName]
      );
    }

    const purchaseResult = await client.query<PurchaseRow>(
      `INSERT INTO purchases (purchased_on, store_name, total_paid_centavos)
       VALUES ($1, $2, $3)
       RETURNING id, purchased_on::text AS "purchasedOn", store_name AS "storeName",
                 currency, total_paid_centavos AS "totalPaidCentavos",
                 created_at AS "createdAt"`,
      [input.purchasedOn, input.storeName ?? null, input.totalPaidCentavos]
    );
    const purchase = purchaseResult.rows[0];
    const items = await insertPurchaseItems(client, purchase.id, input.items);

    await client.query('COMMIT');
    transactionStarted = false;

    return { ...purchase, items };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Keep the original database error for the caller.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function listPurchaseRecords(input: PurchaseListQuery): Promise<{
  purchases: PurchaseRecord[];
  total: number;
}> {
  const offset = (input.page - 1) * input.pageSize;
  const filterValues: string[] = [];
  const conditions: string[] = [];
  const addValue = (value: string) => {
    filterValues.push(value);
    return `$${filterValues.length}`;
  };
  const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

  if (input.search) {
    const searchParameter = addValue(`%${escapeLike(input.search)}%`);
    conditions.push(`EXISTS (
      SELECT 1
      FROM purchase_items pi
      WHERE pi.purchase_id = p.id
        AND pi.item_name ILIKE ${searchParameter} ESCAPE E'\\\\'
    )`);
  }

  if (input.store) {
    const storeParameter = addValue(`%${escapeLike(input.store)}%`);
    conditions.push(`p.store_name ILIKE ${storeParameter} ESCAPE E'\\\\'`);
  }

  if (input.from) conditions.push(`p.purchased_on >= ${addValue(input.from)}::date`);
  if (input.to) conditions.push(`p.purchased_on <= ${addValue(input.to)}::date`);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM purchases p ${whereClause}`,
    filterValues
  );
  const pageSizeParameter = `$${filterValues.length + 1}`;
  const offsetParameter = `$${filterValues.length + 2}`;
  const purchaseResult = await query<PurchaseRow>(
    `SELECT p.id, p.purchased_on::text AS "purchasedOn", p.store_name AS "storeName",
            p.currency, p.total_paid_centavos AS "totalPaidCentavos",
            p.created_at AS "createdAt"
     FROM purchases p
     ${whereClause}
     ORDER BY p.purchased_on DESC, p.created_at DESC, p.id DESC
     LIMIT ${pageSizeParameter} OFFSET ${offsetParameter}`,
    [...filterValues, input.pageSize, offset]
  );

  const purchaseRows = purchaseResult.rows;
  const purchaseIds = purchaseRows.map((purchase) => purchase.id);
  const itemRows = purchaseIds.length === 0
    ? []
    : (await query<PurchaseItemRow>(
      `SELECT id, purchase_id AS "purchaseId", item_name AS "itemName",
              grocery_item_id AS "groceryItemId", quantity, unit,
              amount_paid_centavos AS "amountPaidCentavos"
       FROM purchase_items
       WHERE purchase_id = ANY($1::uuid[])
       ORDER BY purchase_id, position`,
      [purchaseIds]
    )).rows;

  const itemsByPurchase = new Map<string, Array<Omit<PurchaseItemRow, 'purchaseId'>>>();
  for (const item of itemRows) {
    const purchaseItems = itemsByPurchase.get(item.purchaseId) ?? [];
    purchaseItems.push({
      id: item.id,
      groceryItemId: item.groceryItemId,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      amountPaidCentavos: item.amountPaidCentavos,
    });
    itemsByPurchase.set(item.purchaseId, purchaseItems);
  }

  return {
    purchases: purchaseRows.map((purchase) => ({
      ...purchase,
      items: itemsByPurchase.get(purchase.id) ?? [],
    })),
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}
