import { z } from 'zod';

const maxCentavos = 2_147_483_647;
const maxQuantity = 999_999_999.999;

const calendarDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Enter a valid calendar date.');

const centavos = z.number().int().min(0).max(maxCentavos);

export const createPurchaseItemSchema = z.object({
  itemName: z.string().trim().min(1).max(120),
  quantity: z.number()
    .finite()
    .positive()
    .max(maxQuantity)
    .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7),
  unit: z.string().trim().min(1).max(32),
  amountPaidCentavos: centavos,
}).strict();

export const createPurchaseSchema = z.object({
  purchasedOn: calendarDate,
  storeName: z.string().trim().min(1).max(120).optional(),
  totalPaidCentavos: centavos,
  items: z.array(createPurchaseItemSchema).min(1).max(100),
}).strict();

export const purchaseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type PurchaseListQuery = z.infer<typeof purchaseListQuerySchema>;
