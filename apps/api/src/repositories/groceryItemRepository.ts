import { query } from '../db';
import type { GroceryItemListQuery, PriceHistoryQuery } from '../schemas/groceryItem';

export type GroceryItemRecord = {
  id: string;
  name: string;
};

export type PriceObservationRecord = {
  purchaseItemId: string;
  purchaseId: string;
  purchasedOn: string;
  storeName: string | null;
  itemName: string;
  quantity: string | number;
  unit: string;
  amountPaidCentavos: number;
  unitPriceCentavos: string | number;
};

export async function listGroceryItemRecords(input: GroceryItemListQuery): Promise<{
  items: GroceryItemRecord[];
  total: number;
}> {
  const offset = (input.page - 1) * input.pageSize;
  const [countResult, itemResult] = await Promise.all([
    query<{ total: string }>('SELECT COUNT(*) AS total FROM grocery_items'),
    query<GroceryItemRecord>(
      `SELECT id, name
       FROM grocery_items
       ORDER BY name, normalized_name, id
       LIMIT $1 OFFSET $2`,
      [input.pageSize, offset]
    ),
  ]);

  return {
    items: itemResult.rows,
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function listPriceHistoryRecords(
  groceryItemId: string,
  input: PriceHistoryQuery
): Promise<{
  groceryItem: GroceryItemRecord | null;
  observations: PriceObservationRecord[];
  total: number;
}> {
  const offset = (input.page - 1) * input.pageSize;
  const normalizedUnit = input.unit?.trim().replace(/\s+/g, ' ') ?? null;
  const unitExpression = "btrim(regexp_replace(lower(btrim(pi.unit)), '[[:space:]]+', ' ', 'g'))";
  const queryUnitExpression = "btrim(regexp_replace(lower(btrim($2)), '[[:space:]]+', ' ', 'g'))";

  const [itemResult, countResult, historyResult] = await Promise.all([
    query<GroceryItemRecord>(
      'SELECT id, name FROM grocery_items WHERE id = $1',
      [groceryItemId]
    ),
    query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM purchase_items pi
       WHERE pi.grocery_item_id = $1
         AND ($2::text IS NULL OR ${unitExpression} = ${queryUnitExpression})`,
      [groceryItemId, normalizedUnit]
    ),
    query<PriceObservationRecord>(
      `SELECT pi.id AS "purchaseItemId",
              p.id AS "purchaseId",
              p.purchased_on::text AS "purchasedOn",
              p.store_name AS "storeName",
              pi.item_name AS "itemName",
              pi.quantity,
              pi.unit,
              pi.amount_paid_centavos AS "amountPaidCentavos",
              round(pi.amount_paid_centavos::numeric / pi.quantity, 6)::float8
                AS "unitPriceCentavos"
       FROM purchase_items pi
       JOIN purchases p ON p.id = pi.purchase_id
       WHERE pi.grocery_item_id = $1
         AND ($2::text IS NULL OR ${unitExpression} = ${queryUnitExpression})
       ORDER BY p.purchased_on DESC, p.created_at DESC, pi.id DESC
       LIMIT $3 OFFSET $4`,
      [groceryItemId, normalizedUnit, input.pageSize, offset]
    ),
  ]);

  return {
    groceryItem: itemResult.rows[0] ?? null,
    observations: historyResult.rows,
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}
