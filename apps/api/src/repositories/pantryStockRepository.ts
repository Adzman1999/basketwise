import { getPool, query } from '../db';
import type {
  CreatePantryStockInput,
  PantryStockListQuery,
  PantryStockLotsListQuery,
  UpdatePantryStockInput,
  UpdatePantryStockLotExpiryInput,
} from '../schemas/pantryStock';

export type PantryStockRecord = {
  id: string;
  groceryItemId: string;
  itemName: string;
  unitId: string;
  unit: string;
  quantity: string | number;
  lowStockThreshold: string | number | null;
  autoRestock: boolean;
  expiresOn: string | null;
  updatedAt: Date;
};

export type PantryStockLotRecord = {
  id: string;
  pantryStockId: string;
  itemName: string;
  unit: string;
  quantityReceived: string | number;
  quantityRemaining: string | number;
  sourceType: 'opening_balance' | 'purchase' | 'manual_adjustment';
  expiresOn: string | null;
  receivedAt: Date;
  purchaseDate: string | null;
  storeName: string | null;
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
              ps.expires_on::text AS "expiresOn",
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

export async function listPantryStockLotRecords(input: PantryStockLotsListQuery): Promise<{
  items: PantryStockLotRecord[];
  total: number;
}> {
  const offset = (input.page - 1) * input.pageSize;
  const search = input.search?.trim().replace(/\s+/g, ' ').toLowerCase() ?? null;
  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM pantry_stock_lots lot
     JOIN pantry_stock ps ON ps.id = lot.pantry_stock_id
     JOIN grocery_items gi ON gi.id = ps.grocery_item_id
     WHERE lot.quantity_remaining > 0
       AND ($1::text IS NULL OR position($1 in gi.normalized_name) > 0)`,
    [search]
  );
  const itemResult = await query<PantryStockLotRecord>(
    `SELECT lot.id,
            lot.pantry_stock_id AS "pantryStockId",
            gi.name AS "itemName",
            mu.name AS unit,
            lot.quantity_received AS "quantityReceived",
            lot.quantity_remaining AS "quantityRemaining",
            lot.source_type AS "sourceType",
            lot.expires_on::text AS "expiresOn",
            lot.received_at AS "receivedAt",
            p.purchased_on::text AS "purchaseDate",
            p.store_name AS "storeName"
     FROM pantry_stock_lots lot
     JOIN pantry_stock ps ON ps.id = lot.pantry_stock_id
     JOIN grocery_items gi ON gi.id = ps.grocery_item_id
     JOIN measurement_units mu ON mu.id = ps.unit_id
     LEFT JOIN purchase_items pi ON pi.id = lot.source_purchase_item_id
     LEFT JOIN purchases p ON p.id = pi.purchase_id
     WHERE lot.quantity_remaining > 0
       AND ($1::text IS NULL OR position($1 in gi.normalized_name) > 0)
     ORDER BY lot.expires_on ASC NULLS LAST, lot.received_at ASC, gi.normalized_name, lot.id
     LIMIT $2 OFFSET $3`,
    [search, input.pageSize, offset]
  );

  return { items: itemResult.rows, total: countResult.rows[0]?.total ?? 0 };
}

export async function updatePantryStockLotExpiryRecord(
  id: string,
  input: UpdatePantryStockLotExpiryInput
): Promise<PantryStockLotRecord | null> {
  const client = await getPool().connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const lotReference = await client.query<{ pantryStockId: string }>(
      `SELECT pantry_stock_id AS "pantryStockId"
       FROM pantry_stock_lots
       WHERE id = $1 AND quantity_remaining > 0`,
      [id]
    );
    const pantryStockId = lotReference.rows[0]?.pantryStockId;

    if (!pantryStockId) {
      await client.query('COMMIT');
      transactionStarted = false;
      return null;
    }

    const stockLock = await client.query(
      'SELECT id FROM pantry_stock WHERE id = $1 FOR UPDATE',
      [pantryStockId]
    );
    if (stockLock.rowCount !== 1) {
      await client.query('COMMIT');
      transactionStarted = false;
      return null;
    }

    const activeLot = await client.query<{ id: string }>(
      'SELECT id FROM pantry_stock_lots WHERE id = $1 AND quantity_remaining > 0 FOR UPDATE',
      [id]
    );
    if (activeLot.rowCount !== 1) {
      await client.query('COMMIT');
      transactionStarted = false;
      return null;
    }

    await client.query(
      'UPDATE pantry_stock_lots SET expires_on = $2 WHERE id = $1',
      [id, input.expiresOn]
    );
    await client.query(
      `UPDATE pantry_stock
       SET expires_on = (
             SELECT MIN(expires_on)
             FROM pantry_stock_lots
             WHERE pantry_stock_id = $1 AND quantity_remaining > 0
           ),
           updated_at = NOW()
       WHERE id = $1`,
      [pantryStockId]
    );

    const result = await client.query<PantryStockLotRecord>(
      `SELECT lot.id,
              lot.pantry_stock_id AS "pantryStockId",
              gi.name AS "itemName",
              mu.name AS unit,
              lot.quantity_received AS "quantityReceived",
              lot.quantity_remaining AS "quantityRemaining",
              lot.source_type AS "sourceType",
              lot.expires_on::text AS "expiresOn",
              lot.received_at AS "receivedAt",
              p.purchased_on::text AS "purchaseDate",
              p.store_name AS "storeName"
       FROM pantry_stock_lots lot
       JOIN pantry_stock ps ON ps.id = lot.pantry_stock_id
       JOIN grocery_items gi ON gi.id = ps.grocery_item_id
       JOIN measurement_units mu ON mu.id = ps.unit_id
       LEFT JOIN purchase_items pi ON pi.id = lot.source_purchase_item_id
       LEFT JOIN purchases p ON p.id = pi.purchase_id
       WHERE lot.id = $1`,
      [id]
    );

    await client.query('COMMIT');
    transactionStarted = false;
    return result.rows[0] ?? null;
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

export async function pantryReferencesExist(groceryItemId: string, unitId: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM grocery_items WHERE id = $1)
       AND EXISTS (SELECT 1 FROM measurement_units WHERE id = $2) AS exists`,
    [groceryItemId, unitId]
  );
  return result.rows[0]?.exists ?? false;
}

export async function createPantryStockRecord(input: CreatePantryStockInput): Promise<PantryStockRecord | null> {
  const client = await getPool().connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const result = await client.query<PantryStockRecord>(
      `INSERT INTO pantry_stock (
         grocery_item_id, unit_id, quantity, low_stock_threshold, auto_restock, expires_on
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (grocery_item_id, unit_id) DO NOTHING
       RETURNING id,
                 grocery_item_id AS "groceryItemId",
                 (SELECT name FROM grocery_items WHERE id = grocery_item_id) AS "itemName",
                 unit_id AS "unitId",
                 (SELECT name FROM measurement_units WHERE id = unit_id) AS unit,
                 quantity,
                 low_stock_threshold AS "lowStockThreshold",
                 auto_restock AS "autoRestock",
                 expires_on::text AS "expiresOn",
                 updated_at AS "updatedAt"`,
      [input.groceryItemId, input.unitId, input.quantity, input.lowStockThreshold ?? null, input.autoRestock, input.expiresOn ?? null]
    );
    const stock = result.rows[0];

    if (!stock) {
      await client.query('COMMIT');
      transactionStarted = false;
      return null;
    }

    if (input.quantity > 0) {
      await client.query(
        `INSERT INTO pantry_stock_lots (
           pantry_stock_id, source_type, quantity_received, quantity_remaining, expires_on
         )
         VALUES ($1, 'manual_adjustment', $2, $2, $3)`,
        [stock.id, input.quantity, input.expiresOn ?? null]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    return stock;
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

export async function updatePantryStockRecord(
  id: string,
  input: UpdatePantryStockInput
): Promise<PantryStockRecord | null> {
  const client = await getPool().connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const currentResult = await client.query<{ quantity: string | number }>(
      'SELECT quantity FROM pantry_stock WHERE id = $1 FOR UPDATE',
      [id]
    );
    const current = currentResult.rows[0];

    if (!current) {
      await client.query('COMMIT');
      transactionStarted = false;
      return null;
    }

    const quantityInThousandths = (quantity: string | number) => Math.round(Number(quantity) * 1000);
    const quantityDelta = quantityInThousandths(input.quantity) - quantityInThousandths(current.quantity);

    if (quantityDelta > 0) {
      const quantityAdded = quantityDelta / 1000;
      await client.query(
        `INSERT INTO pantry_stock_lots (
           pantry_stock_id, source_type, quantity_received, quantity_remaining
         )
         VALUES ($1, 'manual_adjustment', $2, $2)`,
        [id, quantityAdded]
      );
    } else if (quantityDelta < 0) {
      const quantityRemoved = -quantityDelta / 1000;
      await client.query(
        `WITH ordered_lots AS (
           SELECT id,
                  quantity_remaining,
                  COALESCE(
                    SUM(quantity_remaining) OVER (
                      ORDER BY expires_on ASC NULLS LAST, received_at ASC, id ASC
                      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                    ),
                    0
                  ) AS quantity_before
           FROM pantry_stock_lots
           WHERE pantry_stock_id = $1
             AND quantity_remaining > 0
         )
         UPDATE pantry_stock_lots lot
         SET quantity_remaining = GREATEST(
           0,
           lot.quantity_remaining - GREATEST(0, $2::numeric - ordered.quantity_before)
         )
         FROM ordered_lots ordered
         WHERE lot.id = ordered.id`,
        [id, quantityRemoved]
      );
    }

    const result = await client.query<PantryStockRecord>(
      `UPDATE pantry_stock ps
       SET quantity = $2,
           low_stock_threshold = $3,
           auto_restock = $4,
           expires_on = (
             SELECT MIN(expires_on)
             FROM pantry_stock_lots
             WHERE pantry_stock_id = ps.id AND quantity_remaining > 0
           ),
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
                 ps.expires_on::text AS "expiresOn",
                 ps.updated_at AS "updatedAt"`,
      [id, input.quantity, input.lowStockThreshold, input.autoRestock]
    );

    await client.query('COMMIT');
    transactionStarted = false;
    return result.rows[0] ?? null;
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

export async function deletePantryStockRecord(id: string): Promise<boolean> {
  const result = await query('DELETE FROM pantry_stock WHERE id = $1', [id]);
  return result.rowCount === 1;
}
