import { query } from '../db';
import type { CreatePantryStockInput, PantryStockListQuery, UpdatePantryStockInput } from '../schemas/pantryStock';

export type PantryStockRecord = {
  id: string;
  groceryItemId: string;
  itemName: string;
  unitId: string;
  unit: string;
  quantity: string | number;
  lowStockThreshold: string | number | null;
  autoRestock: boolean;
  updatedAt: Date;
};

const statusExpression = `CASE
  WHEN ps.quantity = 0 THEN 'out_of_stock'
  WHEN ps.low_stock_threshold IS NOT NULL AND ps.quantity <= ps.low_stock_threshold THEN 'low_stock'
  ELSE 'in_stock'
END`;

export async function listPantryStockRecords(input: PantryStockListQuery): Promise<{
  items: PantryStockRecord[];
  total: number;
  summary: { total: number; inStock: number; lowStock: number; outOfStock: number };
}> {
  const offset = (input.page - 1) * input.pageSize;
  const search = input.search?.trim().replace(/\s+/g, ' ').toLowerCase() ?? null;
  const status = input.status ?? null;
  const [summaryResult, countResult, itemResult] = await Promise.all([
    query<{ total: number; inStock: number; lowStock: number; outOfStock: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE ps.quantity > 0
                AND (ps.low_stock_threshold IS NULL OR ps.quantity > ps.low_stock_threshold))::int AS "inStock",
              COUNT(*) FILTER (WHERE ps.quantity > 0
                AND ps.low_stock_threshold IS NOT NULL
                AND ps.quantity <= ps.low_stock_threshold)::int AS "lowStock",
              COUNT(*) FILTER (WHERE ps.quantity = 0)::int AS "outOfStock"
       FROM pantry_stock ps`
    ),
    query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM pantry_stock ps
       JOIN grocery_items gi ON gi.id = ps.grocery_item_id
       WHERE ($1::text IS NULL OR position($1 in gi.normalized_name) > 0)
         AND ($2::text IS NULL OR ${statusExpression} = $2)`,
      [search, status]
    ),
    query<PantryStockRecord>(
      `SELECT ps.id,
              ps.grocery_item_id AS "groceryItemId",
              gi.name AS "itemName",
              ps.unit_id AS "unitId",
              mu.name AS unit,
              ps.quantity,
              ps.low_stock_threshold AS "lowStockThreshold",
              ps.auto_restock AS "autoRestock",
              ps.updated_at AS "updatedAt"
       FROM pantry_stock ps
       JOIN grocery_items gi ON gi.id = ps.grocery_item_id
       JOIN measurement_units mu ON mu.id = ps.unit_id
       WHERE ($1::text IS NULL OR position($1 in gi.normalized_name) > 0)
         AND ($2::text IS NULL OR ${statusExpression} = $2)
       ORDER BY gi.normalized_name, mu.normalized_name, ps.id
       LIMIT $3 OFFSET $4`,
      [search, status, input.pageSize, offset]
    ),
  ]);

  return {
    items: itemResult.rows,
    total: countResult.rows[0]?.total ?? 0,
    summary: summaryResult.rows[0] ?? { total: 0, inStock: 0, lowStock: 0, outOfStock: 0 },
  };
}

export async function pantryReferencesExist(groceryItemId: string, unitId: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM grocery_items WHERE id = $1)
       AND EXISTS (SELECT 1 FROM measurement_units WHERE id = $2) AS exists`,
    [groceryItemId, unitId]
  );
  return result.rows[0]?.exists ?? false;
}

export async function createPantryStockRecord(input: CreatePantryStockInput): Promise<PantryStockRecord | null> {
  const result = await query<PantryStockRecord>(
    `INSERT INTO pantry_stock (grocery_item_id, unit_id, quantity, low_stock_threshold, auto_restock)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (grocery_item_id, unit_id) DO NOTHING
     RETURNING id,
               grocery_item_id AS "groceryItemId",
               (SELECT name FROM grocery_items WHERE id = grocery_item_id) AS "itemName",
               unit_id AS "unitId",
               (SELECT name FROM measurement_units WHERE id = unit_id) AS unit,
               quantity,
               low_stock_threshold AS "lowStockThreshold",
               auto_restock AS "autoRestock",
               updated_at AS "updatedAt"`,
    [input.groceryItemId, input.unitId, input.quantity, input.lowStockThreshold ?? null, input.autoRestock]
  );
  return result.rows[0] ?? null;
}

export async function updatePantryStockRecord(
  id: string,
  input: UpdatePantryStockInput
): Promise<PantryStockRecord | null> {
  const result = await query<PantryStockRecord>(
    `UPDATE pantry_stock ps
     SET quantity = $2,
         low_stock_threshold = $3,
         auto_restock = $4,
         updated_at = NOW()
     FROM grocery_items gi, measurement_units mu
     WHERE ps.id = $1
       AND gi.id = ps.grocery_item_id
       AND mu.id = ps.unit_id
     RETURNING ps.id,
               ps.grocery_item_id AS "groceryItemId",
               (SELECT item.name FROM grocery_items item WHERE item.id = ps.grocery_item_id) AS "itemName",
               ps.unit_id AS "unitId",
               (SELECT measure.name FROM measurement_units measure WHERE measure.id = ps.unit_id) AS unit,
               ps.quantity,
               ps.low_stock_threshold AS "lowStockThreshold",
               ps.auto_restock AS "autoRestock",
               ps.updated_at AS "updatedAt"`,
    [id, input.quantity, input.lowStockThreshold, input.autoRestock]
  );
  return result.rows[0] ?? null;
}

export async function deletePantryStockRecord(id: string): Promise<boolean> {
  const result = await query('DELETE FROM pantry_stock WHERE id = $1', [id]);
  return result.rowCount === 1;
}
