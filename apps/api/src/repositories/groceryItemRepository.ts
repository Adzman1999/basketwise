import { query } from '../db';
import type {
  GroceryItemListQuery,
  PriceHistoryQuery,
  SaveGroceryItemUnitConversionInput,
} from '../schemas/groceryItem';

export type GroceryItemRecord = {
  id: string;
  name: string;
};

export type PriceObservationRecord = {
  purchaseItemId: string;
  purchaseId: string;
  unitId: string;
  purchasedOn: string;
  storeName: string | null;
  itemName: string;
  quantity: string | number;
  unit: string;
  amountPaidCentavos: number;
  unitPriceCentavos: string | number;
};

export type GroceryItemUnitConversionRecord = {
  id: string;
  purchaseUnitId: string;
  purchaseUnit: string;
  recipeUnitId: string;
  recipeUnit: string;
  recipeUnitsPerPurchaseUnit: string | number;
};

export async function listGroceryItemRecords(input: GroceryItemListQuery): Promise<{
  items: GroceryItemRecord[];
  total: number;
}> {
  const offset = (input.page - 1) * input.pageSize;
  const search = input.search?.trim().replace(/\s+/g, ' ').toLowerCase() ?? null;
  const [countResult, itemResult] = await Promise.all([
    query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM grocery_items
       WHERE $1::text IS NULL OR position($1 in normalized_name) > 0`,
      [search]
    ),
    query<GroceryItemRecord>(
      `SELECT id, name
       FROM grocery_items
       WHERE $1::text IS NULL OR position($1 in normalized_name) > 0
       ORDER BY name, normalized_name, id
       LIMIT $2 OFFSET $3`,
      [search, input.pageSize, offset]
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
  units: Array<{ id: string; name: string }>;
  total: number;
}> {
  const offset = (input.page - 1) * input.pageSize;
  const normalizedUnit = input.unit?.trim().replace(/\s+/g, ' ') ?? null;
  const unitExpression = "btrim(regexp_replace(lower(btrim(pi.unit)), '[[:space:]]+', ' ', 'g'))";
  const queryUnitExpression = "btrim(regexp_replace(lower(btrim($2)), '[[:space:]]+', ' ', 'g'))";

  const [itemResult, countResult, historyResult, unitResult] = await Promise.all([
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
              pi.unit_id AS "unitId",
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
    query<{ id: string; name: string }>(
      `SELECT DISTINCT mu.id, mu.name
       FROM purchase_items pi
       JOIN measurement_units mu ON mu.id = pi.unit_id
       WHERE pi.grocery_item_id = $1
       ORDER BY mu.name, mu.id`,
      [groceryItemId]
    ),
  ]);

  return {
    groceryItem: itemResult.rows[0] ?? null,
    observations: historyResult.rows,
    units: unitResult.rows,
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function listGroceryItemUnitConversionRecords(
  groceryItemId: string
): Promise<{ groceryItem: GroceryItemRecord | null; items: GroceryItemUnitConversionRecord[] }> {
  const [itemResult, conversionResult] = await Promise.all([
    query<GroceryItemRecord>('SELECT id, name FROM grocery_items WHERE id = $1', [groceryItemId]),
    query<GroceryItemUnitConversionRecord>(
      `SELECT conversion.id,
              conversion.purchase_unit_id AS "purchaseUnitId",
              purchase_unit.name AS "purchaseUnit",
              conversion.recipe_unit_id AS "recipeUnitId",
              recipe_unit.name AS "recipeUnit",
              conversion.recipe_units_per_purchase_unit AS "recipeUnitsPerPurchaseUnit"
       FROM grocery_item_unit_conversions conversion
       JOIN measurement_units purchase_unit ON purchase_unit.id = conversion.purchase_unit_id
       JOIN measurement_units recipe_unit ON recipe_unit.id = conversion.recipe_unit_id
       WHERE conversion.grocery_item_id = $1
       ORDER BY purchase_unit.name, recipe_unit.name, conversion.id`,
      [groceryItemId]
    ),
  ]);
  return { groceryItem: itemResult.rows[0] ?? null, items: conversionResult.rows };
}

export async function saveGroceryItemUnitConversionRecord(
  groceryItemId: string,
  input: SaveGroceryItemUnitConversionInput
): Promise<GroceryItemUnitConversionRecord | null> {
  const result = await query<GroceryItemUnitConversionRecord>(
    `WITH saved AS (
       INSERT INTO grocery_item_unit_conversions (
         grocery_item_id, purchase_unit_id, recipe_unit_id, recipe_units_per_purchase_unit
       )
       SELECT $1, purchase_unit.id, recipe_unit.id, $4
       FROM measurement_units purchase_unit, measurement_units recipe_unit
       WHERE purchase_unit.id = $2
         AND recipe_unit.id = $3
         AND purchase_unit.id <> recipe_unit.id
         AND EXISTS (SELECT 1 FROM grocery_items WHERE id = $1)
       ON CONFLICT (
         grocery_item_id,
         (LEAST(purchase_unit_id, recipe_unit_id)),
         (GREATEST(purchase_unit_id, recipe_unit_id))
       ) DO UPDATE
         SET purchase_unit_id = EXCLUDED.purchase_unit_id,
             recipe_unit_id = EXCLUDED.recipe_unit_id,
             recipe_units_per_purchase_unit = EXCLUDED.recipe_units_per_purchase_unit,
             updated_at = NOW()
       RETURNING id,
                 purchase_unit_id,
                 recipe_unit_id,
                 recipe_units_per_purchase_unit
     )
     SELECT saved.id,
            saved.purchase_unit_id AS "purchaseUnitId",
            purchase_unit.name AS "purchaseUnit",
            saved.recipe_unit_id AS "recipeUnitId",
            recipe_unit.name AS "recipeUnit",
            saved.recipe_units_per_purchase_unit AS "recipeUnitsPerPurchaseUnit"
     FROM saved
     JOIN measurement_units purchase_unit ON purchase_unit.id = saved.purchase_unit_id
     JOIN measurement_units recipe_unit ON recipe_unit.id = saved.recipe_unit_id`,
    [groceryItemId, input.purchaseUnitId, input.recipeUnitId, input.recipeUnitsPerPurchaseUnit]
  );
  return result.rows[0] ?? null;
}

export async function deleteGroceryItemUnitConversionRecord(
  groceryItemId: string,
  conversionId: string
): Promise<boolean> {
  const result = await query(
    'DELETE FROM grocery_item_unit_conversions WHERE grocery_item_id = $1 AND id = $2',
    [groceryItemId, conversionId]
  );
  return result.rowCount === 1;
}
