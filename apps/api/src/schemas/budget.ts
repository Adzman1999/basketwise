import { z } from 'zod';

const maxBudgetCentavos = 2_147_483_647;

export const monthlyBudgetParamsSchema = z.object({
  month: z.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .refine((value) => Number(value.slice(0, 4)) > 0),
}).strict();

export const setMonthlyBudgetSchema = z.object({
  budgetCentavos: z.number().int().min(1).max(maxBudgetCentavos),
}).strict();

export type SetMonthlyBudgetInput = z.infer<typeof setMonthlyBudgetSchema>;
