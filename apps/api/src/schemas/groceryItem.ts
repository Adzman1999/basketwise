import { z } from 'zod';

const pagination = {
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const groceryItemListQuerySchema = z.object({
  ...pagination,
  search: z.string().trim().min(1).max(120).optional(),
}).strict();

export const priceHistoryQuerySchema = z.object({
  ...pagination,
  unit: z.string().trim().min(1).max(32).optional(),
}).strict();

export const groceryItemIdSchema = z.string().uuid();
export const groceryItemUnitConversionIdSchema = z.string().uuid();

export const saveGroceryItemUnitConversionSchema = z.object({
  purchaseUnitId: z.string().uuid(),
  recipeUnitId: z.string().uuid(),
  recipeUnitsPerPurchaseUnit: z.number()
    .finite()
    .positive()
    .max(999_999_999.999999999)
    .refine((value) => Math.abs(value * 1_000_000_000 - Math.round(value * 1_000_000_000)) < 0.0001),
}).strict().refine((conversion) => conversion.purchaseUnitId !== conversion.recipeUnitId, {
  path: ['recipeUnitId'],
  message: 'Choose two different units.',
});

export type GroceryItemListQuery = z.infer<typeof groceryItemListQuerySchema>;
export type PriceHistoryQuery = z.infer<typeof priceHistoryQuerySchema>;
export type SaveGroceryItemUnitConversionInput = z.infer<typeof saveGroceryItemUnitConversionSchema>;
