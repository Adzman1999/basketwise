import { z } from 'zod';

const quantity = z.number()
  .finite()
  .min(0)
  .max(999_999_999.999)
  .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001);

const pagination = {
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const pantryStockStatuses = ['in_stock', 'low_stock', 'out_of_stock'] as const;

export const pantryStockListQuerySchema = z.object({
  ...pagination,
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(pantryStockStatuses).optional(),
}).strict();

export const pantryStockIdSchema = z.string().uuid();

export const createPantryStockSchema = z.object({
  groceryItemId: z.string().uuid(),
  unitId: z.string().uuid(),
  quantity,
  lowStockThreshold: quantity.nullable().optional(),
}).strict();

export const updatePantryStockSchema = z.object({
  quantity,
  lowStockThreshold: quantity.nullable(),
}).strict();

export type PantryStockListQuery = z.infer<typeof pantryStockListQuerySchema>;
export type CreatePantryStockInput = z.infer<typeof createPantryStockSchema>;
export type UpdatePantryStockInput = z.infer<typeof updatePantryStockSchema>;
