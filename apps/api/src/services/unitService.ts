import { createUnitRecord, listUnitRecords } from '../repositories/unitRepository';
import type { CreateUnitInput } from '../schemas/unit';

export class DuplicateUnitError extends Error {
  constructor() {
    super('This unit is already saved.');
    this.name = 'DuplicateUnitError';
  }
}

export async function listUnits() {
  const items = await listUnitRecords();
  return { items, total: items.length };
}

export async function createUnit(input: CreateUnitInput) {
  const unit = await createUnitRecord(input);
  if (!unit) throw new DuplicateUnitError();
  return unit;
}
