import type { PoolClient } from 'pg';
import { getPool, query } from '../db';
import type { AddPurchaseItemsToPantryInput, CreatePurchaseInput, PurchaseListQuery } from '../schemas/purchase';

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
  expiresOn: string | null;
  pantryAdded: boolean;
};

type PurchaseItemRecord = Omit<PurchaseItemRow, 'purchaseId'>;
type PurchaseItemInsertRecord = Omit<PurchaseItemRecord, 'pantryAdded'>;

export type PurchaseRecord = PurchaseRow & {
  items: PurchaseItemRecord[];
  pantryRestockedItems?: PantryRestockedItemRecord[];
};

export type PantryRestockedItemRecord = {
  itemName: string;
  unit: string;
  quantityAdded: number;
  quantityOnHand: number;
  expiresOn: string | null;
};

async function insertPurchaseItems(
  client: PoolClient,
  purchaseId: string,
  items: CreatePurchaseInput['items']
): Promise<PurchaseItemInsertRecord[]> {
  const insertedItems: PurchaseItemInsertRecord[] = [];

  for (const [position, item] of items.entries()) {
    const result = await client.query<PurchaseItemInsertRecord>(
      `WITH catalog_item AS (
         INSERT INTO grocery_items (name, normalized_name)
         VALUES (
           btrim(regexp_replace(btrim($3), '[[:space:]]+', ' ', 'g')),
           btrim(regexp_replace(lower(btrim($3)), '[[:space:]]+', ' ', 'g'))
         )
         ON CONFLICT (normalized_name)
         DO UPDATE SET normalized_name = EXCLUDED.normalized_name
         RETURNING id
       ), unit_record AS (
         INSERT INTO measurement_units (name, normalized_name, is_preset)
         VALUES (
           btrim(regexp_replace($5, '[[:space:]]+', ' ', 'g')),
           btrim(regexp_replace(lower(btrim($5)), '[[:space:]]+', ' ', 'g')),
           FALSE
         )
         ON CONFLICT (normalized_name)
         DO UPDATE SET normalized_name = EXCLUDED.normalized_name
         RETURNING id
       )
       INSERT INTO purchase_items (
         purchase_id, position, grocery_item_id, unit_id, item_name, quantity,
         unit, amount_paid_centavos, expires_on
       )
       SELECT $1, $2, catalog_item.id, unit_record.id, $3, $4, $5, $6, $7
       FROM catalog_item, unit_record
       RETURNING id, grocery_item_id AS "groceryItemId", item_name AS "itemName", quantity, unit,
                 amount_paid_centavos AS "amountPaidCentavos",
                 expires_on::text AS "expiresOn"`,
      [purchaseId, position, item.itemName, item.quantity, item.unit, item.amountPaidCentavos, item.expiresOn ?? null]
    );
    insertedItems.push(result.rows[0]);
  }

  return insertedItems;
}

async function restockPantryFromPurchase(
  client: PoolClient,
  purchaseId: string,
  addToPantry: boolean
): Promise<PantryRestockedItemRecord[]> {
  if (addToPantry) {
    await client.query(
      `INSERT INTO pantry_stock (grocery_item_id, unit_id, quantity)
       SELECT DISTINCT pi.grocery_item_id, pi.unit_id, 0
       FROM purchase_items pi
       WHERE pi.purchase_id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM pantry_stock_purchase_movements movement
           WHERE movement.purchase_item_id = pi.id
         )
       ON CONFLICT (grocery_item_id, unit_id) DO NOTHING`,
      [purchaseId]
    );
  }

  const result = await client.query<PantryRestockedItemRecord>(
    `WITH eligible_items AS MATERIALIZED (
       SELECT ps.id AS pantry_stock_id,
              pi.id AS purchase_item_id,
              pi.quantity AS quantity_added,
              pi.expires_on
       FROM pantry_stock ps
       JOIN purchase_items pi
         ON pi.grocery_item_id = ps.grocery_item_id
        AND pi.unit_id = ps.unit_id
       WHERE pi.purchase_id = $1
         AND ($2::boolean = TRUE OR ps.auto_restock = TRUE)
       ORDER BY ps.id, pi.id
       FOR UPDATE OF ps
     ), inserted_lots AS (
       INSERT INTO pantry_stock_lots (
         pantry_stock_id, source_type, source_purchase_item_id,
         quantity_received, quantity_remaining, expires_on
       )
       SELECT eligible.pantry_stock_id, 'purchase', eligible.purchase_item_id,
              eligible.quantity_added, eligible.quantity_added, eligible.expires_on
       FROM eligible_items eligible
       ON CONFLICT (source_purchase_item_id)
         WHERE source_purchase_item_id IS NOT NULL
         DO NOTHING
       RETURNING id, source_purchase_item_id, pantry_stock_id,
                 quantity_received AS quantity_added, expires_on
     ), recorded_movements AS (
       INSERT INTO pantry_stock_purchase_movements (
         purchase_item_id, pantry_stock_id, quantity_added, pantry_stock_lot_id
       )
       SELECT source_purchase_item_id, pantry_stock_id, quantity_added, id
       FROM inserted_lots
       ON CONFLICT (purchase_item_id) DO NOTHING
       RETURNING pantry_stock_id, quantity_added
     ), restock_totals AS (
       SELECT pantry_stock_id, SUM(quantity_added) AS quantity_added
       FROM recorded_movements
       GROUP BY pantry_stock_id
     ), updated_stock AS (
       UPDATE pantry_stock ps
       SET quantity = ps.quantity + totals.quantity_added,
           expires_on = (
             SELECT MIN(expiry)
             FROM (
               SELECT existing.expires_on AS expiry
               FROM pantry_stock_lots existing
               WHERE existing.pantry_stock_id = ps.id
                 AND existing.quantity_remaining > 0
               UNION ALL
               SELECT new_lot.expires_on AS expiry
               FROM inserted_lots new_lot
               WHERE new_lot.pantry_stock_id = ps.id
             ) active_expiries
           ),
           updated_at = NOW()
       FROM restock_totals totals
       WHERE ps.id = totals.pantry_stock_id
       RETURNING ps.id, ps.grocery_item_id, ps.unit_id, ps.quantity, ps.expires_on
     )
     SELECT gi.name AS "itemName",
            mu.name AS unit,
            totals.quantity_added::float8 AS "quantityAdded",
            updated_stock.quantity::float8 AS "quantityOnHand",
            updated_stock.expires_on::text AS "expiresOn"
     FROM restock_totals totals
     JOIN updated_stock ON updated_stock.id = totals.pantry_stock_id
     JOIN grocery_items gi ON gi.id = updated_stock.grocery_item_id
     JOIN measurement_units mu ON mu.id = updated_stock.unit_id
     ORDER BY gi.normalized_name, mu.normalized_name, updated_stock.id`,
    [purchaseId, addToPantry]
  );
  return result.rows;
}

async function attachPantryStatus(
  client: PoolClient,
  purchaseId: string,
  items: PurchaseItemInsertRecord[]
): Promise<PurchaseItemRecord[]> {
  const result = await client.query<{ purchaseItemId: string; pantryAdded: boolean }>(
    `SELECT pi.id AS "purchaseItemId",
            EXISTS (
              SELECT 1
              FROM pantry_stock_purchase_movements movement
              WHERE movement.purchase_item_id = pi.id
            ) AS "pantryAdded"
     FROM purchase_items pi
     WHERE pi.purchase_id = $1`,
    [purchaseId]
  );
  const pantryAddedById = new Map(result.rows.map((row) => [row.purchaseItemId, row.pantryAdded]));
  return items.map((item) => ({ ...item, pantryAdded: pantryAddedById.get(item.id) ?? false }));
}

export async function createPurchaseRecord(input: CreatePurchaseInput): Promise<PurchaseRecord> {
  const client = await getPool().connect();
  let transactionStarted = false;
  const totalPaidCentavos = input.items.reduce((total, item) => total + item.amountPaidCentavos, 0);

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
      [input.purchasedOn, input.storeName ?? null, totalPaidCentavos]
    );
    const purchase = purchaseResult.rows[0];
    const insertedItems = await insertPurchaseItems(client, purchase.id, input.items);
    const pantryRestockedItems = await restockPantryFromPurchase(
      client,
      purchase.id,
      input.addToPantry
    );
    const items = await attachPantryStatus(client, purchase.id, insertedItems);

    await client.query('COMMIT');
    transactionStarted = false;

    return { ...purchase, items, pantryRestockedItems };
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

export async function addPurchaseItemsToPantryRecord(
  purchaseId: string,
  input: AddPurchaseItemsToPantryInput
): Promise<PantryRestockedItemRecord[] | null> {
  const client = await getPool().connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const purchaseResult = await client.query<{ id: string }>(
      'SELECT id FROM purchases WHERE id = $1 FOR UPDATE',
      [purchaseId]
    );
    if (purchaseResult.rowCount !== 1) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return null;
    }

    for (const expiryDate of input.expiryDates) {
      await client.query(
        `UPDATE purchase_items pi
         SET expires_on = $3
         WHERE pi.id = $1
           AND pi.purchase_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM pantry_stock_purchase_movements movement
             WHERE movement.purchase_item_id = pi.id
           )`,
        [expiryDate.purchaseItemId, purchaseId, expiryDate.expiresOn]
      );
    }

    const pantryRestockedItems = await restockPantryFromPurchase(client, purchaseId, true);
    await client.query('COMMIT');
    transactionStarted = false;
    return pantryRestockedItems;
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

  if (input.pantryStatus === 'pending') {
    conditions.push(`EXISTS (
      SELECT 1
      FROM purchase_items pi
      WHERE pi.purchase_id = p.id
        AND NOT EXISTS (
          SELECT 1
          FROM pantry_stock_purchase_movements movement
          WHERE movement.purchase_item_id = pi.id
        )
    )`);
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
              amount_paid_centavos AS "amountPaidCentavos",
              expires_on::text AS "expiresOn",
              EXISTS (
                SELECT 1
                FROM pantry_stock_purchase_movements movement
                WHERE movement.purchase_item_id = purchase_items.id
              ) AS "pantryAdded"
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
      expiresOn: item.expiresOn,
      pantryAdded: item.pantryAdded,
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
