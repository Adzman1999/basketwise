import { z } from 'zod';

export const storeCategories = [
  'supermarket',
  'public_market',
  'convenience_store',
  'neighborhood_grocery',
  'online_grocery',
  'other',
] as const;

export const createStoreSchema = z.object({
  name: z.string().trim().min(1).max(120).transform((value) => value.replace(/\s+/g, ' ')),
  category: z.enum(storeCategories),
}).strict();

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type StoreCategory = (typeof storeCategories)[number];
