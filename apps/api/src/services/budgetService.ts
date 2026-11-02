import {
  deleteBudgetRecord,
  getBudgetRecord,
  saveBudgetRecord,
} from '../repositories/budgetRepository';
import type { BudgetPeriod, SetBudgetInput } from '../schemas/budget';

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
