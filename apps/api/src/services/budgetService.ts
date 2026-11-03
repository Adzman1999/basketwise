import {
  getBudgetCalendarRecords,
  deleteBudgetRecord,
  getBudgetRecord,
  saveBudgetRecord,
} from '../repositories/budgetRepository';
import type { BudgetPeriod, SetBudgetInput } from '../schemas/budget';

export type BudgetCalendarStatus = 'no_target' | 'remaining' | 'at_limit' | 'exceeded';

export async function getBudgetCalendar(month: string) {
  const days = await getBudgetCalendarRecords(month);
  return {
    month,
    days: days.map((day) => {
      const remainingCentavos = day.budgetCentavos === null
        ? null
        : day.budgetCentavos - day.spentCentavos;
      const status: BudgetCalendarStatus = remainingCentavos === null
        ? 'no_target'
        : remainingCentavos < 0
          ? 'exceeded'
          : remainingCentavos === 0
            ? 'at_limit'
            : 'remaining';

      return { ...day, remainingCentavos, status };
    }),
  };
}

async function getBudgetSummary(period: BudgetPeriod) {
  const record = await getBudgetRecord(period);
  return {
    ...record,
    currency: 'PHP' as const,
    remainingCentavos: record.budgetCentavos === null
      ? null
      : record.budgetCentavos - record.spentCentavos,
  };
}

export async function getBudget(period: BudgetPeriod) {
  return getBudgetSummary(period);
}

export async function saveBudget(period: BudgetPeriod, input: SetBudgetInput) {
  await saveBudgetRecord(period, input);
  return getBudgetSummary(period);
}

export async function deleteBudget(period: BudgetPeriod) {
  await deleteBudgetRecord(period);
  return getBudgetSummary(period);
}
