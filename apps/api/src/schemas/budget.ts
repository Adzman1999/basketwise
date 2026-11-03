import { z } from 'zod';

const maxBudgetCentavos = 2_147_483_647;

export const budgetPeriodTypes = ['day', 'week', 'month', 'year', 'custom'] as const;
const calendarDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number(value.slice(0, 4)) > 0
      && !Number.isNaN(parsed.valueOf())
      && parsed.toISOString().slice(0, 10) === value;
  });

function dayDistance(startsOn: string, endsOn: string): number {
  return (Date.parse(`${endsOn}T00:00:00.000Z`) - Date.parse(`${startsOn}T00:00:00.000Z`)) / 86_400_000;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export const budgetPeriodParamsSchema = z.object({
  periodType: z.enum(budgetPeriodTypes),
  startsOn: calendarDate,
  endsOn: calendarDate,
}).strict().superRefine((period, context) => {
  if (period.startsOn > period.endsOn) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsOn'],
      message: 'The end date must be on or after the start date.',
    });
    return;
  }

  const start = new Date(`${period.startsOn}T00:00:00.000Z`);
  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth() + 1;
  const startDay = start.getUTCDate();
  const end = new Date(`${period.endsOn}T00:00:00.000Z`);
  const isCanonicalPeriod = period.periodType === 'custom'
    || (period.periodType === 'day' && period.startsOn === period.endsOn)
    || (period.periodType === 'week' && start.getUTCDay() === 1 && dayDistance(period.startsOn, period.endsOn) === 6)
    || (period.periodType === 'month'
      && startDay === 1
      && end.getUTCFullYear() === startYear
      && end.getUTCMonth() + 1 === startMonth
      && end.getUTCDate() === daysInMonth(startYear, startMonth))
    || (period.periodType === 'year'
      && startMonth === 1
      && startDay === 1
      && end.getUTCFullYear() === startYear
      && end.getUTCMonth() === 11
      && end.getUTCDate() === 31);

  if (!isCanonicalPeriod) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsOn'],
      message: 'The dates do not match the selected budget period.',
    });
  }
});

export const budgetCalendarParamsSchema = z.object({
  month: z.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .refine((value) => Number(value.slice(0, 4)) > 0),
}).strict();

export const setBudgetSchema = z.object({
  budgetCentavos: z.number().int().min(1).max(maxBudgetCentavos),
}).strict();

export type BudgetPeriodType = (typeof budgetPeriodTypes)[number];
export type BudgetPeriod = z.infer<typeof budgetPeriodParamsSchema>;
export type BudgetCalendarParams = z.infer<typeof budgetCalendarParamsSchema>;
export type SetBudgetInput = z.infer<typeof setBudgetSchema>;
