import { z } from 'zod';

const calendarDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number(value.slice(0, 4)) > 0
      && !Number.isNaN(parsed.valueOf())
      && parsed.toISOString().slice(0, 10) === value;
  });

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const mealPlanIdSchema = z.string().uuid();

export const mealPlanListQuerySchema = z.object({
  from: calendarDate,
  to: calendarDate,
}).strict().superRefine((range, context) => {
  if (range.from > range.to) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['to'],
      message: 'The end date must be on or after the start date.',
    });
    return;
  }

  const days = (Date.parse(`${range.to}T00:00:00.000Z`) - Date.parse(`${range.from}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (days > 42) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['to'],
      message: 'A meal plan request cannot span more than 42 days.',
    });
  }
});

export const saveMealPlanSchema = z.object({
  recipeId: z.string().uuid(),
  plannedOn: calendarDate,
  mealType: z.enum(mealTypes),
  servings: z.number().int().min(1).max(1000),
}).strict();

export type MealPlanListQuery = z.infer<typeof mealPlanListQuerySchema>;
export type SaveMealPlanInput = z.infer<typeof saveMealPlanSchema>;
export type MealType = (typeof mealTypes)[number];
