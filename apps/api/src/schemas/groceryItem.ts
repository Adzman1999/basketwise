import { z } from 'zod';

const pagination = {
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const groceryItemListQuerySchema = z.object(pagination).strict();

export const priceHistoryQuerySchema = z.object({
  ...pagination,
  unit: z.string().trim().min(1).max(32).optional(),
}).strict();

export const groceryItemIdSchema = z.string().uuid();

export type GroceryItemListQuery = z.infer<typeof groceryItemListQuerySchema>;
export type PriceHistoryQuery = z.infer<typeof priceHistoryQuerySchema>;
