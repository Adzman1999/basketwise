import { query } from '../db';
import type { CreateStoreInput, StoreCategory } from '../schemas/store';

export type StoreRecord = {
  id: string;
  name: string;
  category: StoreCategory;
  createdAt: Date;
};

export async function listStoreRecords(): Promise<StoreRecord[]> {
  const result = await query<StoreRecord>(
    `SELECT id, name, category, created_at AS "createdAt"
     FROM stores
     ORDER BY name, normalized_name, id`
  );
  return result.rows;
}

export async function createStoreRecord(input: CreateStoreInput): Promise<StoreRecord | null> {
  const result = await query<StoreRecord>(
    `INSERT INTO stores (name, normalized_name, category)
     VALUES (
       btrim(regexp_replace($1, '[[:space:]]+', ' ', 'g')),
       btrim(regexp_replace(lower(btrim($1)), '[[:space:]]+', ' ', 'g')),
       $2
     )
     ON CONFLICT (normalized_name) DO NOTHING
     RETURNING id, name, category, created_at AS "createdAt"`,
    [input.name, input.category]
  );

  return result.rows[0] ?? null;
}
