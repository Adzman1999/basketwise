import { query } from '../db';
import type { CreateUnitInput } from '../schemas/unit';

export type UnitRecord = {
  id: string;
  name: string;
  isPreset: boolean;
  createdAt: Date;
};

export async function listUnitRecords(): Promise<UnitRecord[]> {
  const result = await query<UnitRecord>(
    `SELECT id, name, is_preset AS "isPreset", created_at AS "createdAt"
     FROM measurement_units
     ORDER BY is_preset DESC, normalized_name, id`
  );
  return result.rows;
}

export async function createUnitRecord(input: CreateUnitInput): Promise<UnitRecord | null> {
  const result = await query<UnitRecord>(
    `INSERT INTO measurement_units (name, normalized_name, is_preset)
     VALUES (
       btrim(regexp_replace($1, '[[:space:]]+', ' ', 'g')),
       btrim(regexp_replace(lower(btrim($1)), '[[:space:]]+', ' ', 'g')),
       FALSE
     )
     ON CONFLICT (normalized_name) DO NOTHING
     RETURNING id, name, is_preset AS "isPreset", created_at AS "createdAt"`,
    [input.name]
  );
  return result.rows[0] ?? null;
}
