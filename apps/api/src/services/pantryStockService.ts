import {
  createPantryStockRecord,
  deletePantryStockRecord,
  listPantryStockWasteRecords,
  listPantryStockLotRecords,
  listPantryStockRecords,
  pantryReferencesExist,
  recordPantryStockWasteRecord,
  updatePantryStockRecord,
  updatePantryStockLotExpiryRecord,
} from '../repositories/pantryStockRepository';
import type { PantryStockLotRecord, PantryStockRecord, PantryStockWasteRecord } from '../repositories/pantryStockRepository';
import type {
  CreatePantryStockInput,
  PantryStockListQuery,
  PantryStockLotsListQuery,
  PantryStockWasteListQuery,
  RecordPantryStockWasteInput,
  UpdatePantryStockInput,
  UpdatePantryStockLotExpiryInput,
} from '../schemas/pantryStock';

export class DuplicatePantryStockError extends Error {
  constructor() {
    super('This grocery item and unit are already tracked in the pantry. Update its current stock instead.');
    this.name = 'DuplicatePantryStockError';
  }
}

export class InvalidPantryReferenceError extends Error {
  constructor() {
    super('Choose a saved grocery item and measurement unit.');
    this.name = 'InvalidPantryReferenceError';
  }
}

function presentStock(record: PantryStockRecord) {
  const quantity = Number(record.quantity);
  const lowStockThreshold = record.lowStockThreshold === null ? null : Number(record.lowStockThreshold);
  const status = quantity === 0
    ? 'out_of_stock' as const
    : lowStockThreshold !== null && quantity <= lowStockThreshold
      ? 'low_stock' as const
      : 'in_stock' as const;
  return { ...record, quantity, lowStockThreshold, status };
}

function presentLot(record: PantryStockLotRecord) {
  return {
    ...record,
    quantityReceived: Number(record.quantityReceived),
    quantityRemaining: Number(record.quantityRemaining),
    receivedAt: record.receivedAt.toISOString(),
  };
}

function presentWaste(record: PantryStockWasteRecord) {
  return {
    ...record,
    quantityWasted: Number(record.quantityWasted),
    quantityRemainingAfter: Number(record.quantityRemainingAfter),
    discardedAt: record.discardedAt.toISOString(),
    receivedAt: record.receivedAt.toISOString(),
  };
}

export async function listPantryStock(input: PantryStockListQuery) {
  const result = await listPantryStockRecords(input);
  return {
    items: result.items.map(presentStock),
    page: input.page,
    pageSize: input.pageSize,
    total: result.total,
    summary: result.summary,
  };
}

export async function listPantryStockLots(input: PantryStockLotsListQuery) {
  const result = await listPantryStockLotRecords(input);
  return {
    items: result.items.map(presentLot),
    page: input.page,
    pageSize: input.pageSize,
    total: result.total,
  };
}

export async function listPantryStockWaste(input: PantryStockWasteListQuery) {
  const result = await listPantryStockWasteRecords(input);
  return {
    items: result.items.map(presentWaste),
    page: input.page,
    pageSize: input.pageSize,
    total: result.total,
  };
}

export async function updatePantryStockLotExpiry(
  id: string,
  input: UpdatePantryStockLotExpiryInput
) {
  const record = await updatePantryStockLotExpiryRecord(id, input);
  return record ? presentLot(record) : null;
}

export async function recordPantryStockWaste(lotId: string, input: RecordPantryStockWasteInput) {
  const result = await recordPantryStockWasteRecord(lotId, input);
  return result.kind === 'recorded'
    ? { kind: result.kind, waste: presentWaste(result.record) }
    : result;
}

export async function createPantryStock(input: CreatePantryStockInput) {
  if (!await pantryReferencesExist(input.groceryItemId, input.unitId)) {
    throw new InvalidPantryReferenceError();
  }
  const record = await createPantryStockRecord(input);
  if (record) return presentStock(record);
  throw new DuplicatePantryStockError();
}

export async function updatePantryStock(id: string, input: UpdatePantryStockInput) {
  const record = await updatePantryStockRecord(id, input);
  return record ? presentStock(record) : null;
}

export async function deletePantryStock(id: string) {
  return deletePantryStockRecord(id);
}
