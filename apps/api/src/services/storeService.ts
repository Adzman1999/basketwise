import { createStoreRecord, listStoreRecords } from '../repositories/storeRepository';
import type { CreateStoreInput } from '../schemas/store';

export class DuplicateStoreError extends Error {
  constructor() {
    super('A store or shop with this name already exists.');
    this.name = 'DuplicateStoreError';
  }
}

export async function listStores() {
  const items = await listStoreRecords();
  return { items, total: items.length };
}

export async function createStore(input: CreateStoreInput) {
  const store = await createStoreRecord(input);
  if (!store) throw new DuplicateStoreError();
  return store;
}
