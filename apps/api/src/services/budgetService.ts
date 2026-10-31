import {
  deleteMonthlyBudgetRecord,
  getMonthlyBudgetRecord,
  saveMonthlyBudgetRecord,
} from '../repositories/budgetRepository';
import type { SetMonthlyBudgetInput } from '../schemas/budget';

function toMonthlyBudgetResponse(record: Awaited<ReturnType<typeof getMonthlyBudgetRecord>>) {
  return {
    month: record.month,
    currency: 'PHP' as const,
    budgetCentavos: record.budgetCentavos,
    spentCentavos: record.spentCentavos,
    remainingCentavos: record.budgetCentavos === null
      ? null
      : record.budgetCentavos - record.spentCentavos,
  };
}

export async function getMonthlyBudget(month: string) {
  return toMonthlyBudgetResponse(await getMonthlyBudgetRecord(month));
}

export async function saveMonthlyBudget(month: string, input: SetMonthlyBudgetInput) {
  await saveMonthlyBudgetRecord(month, input);
  return getMonthlyBudget(month);
}

export async function deleteMonthlyBudget(month: string) {
  await deleteMonthlyBudgetRecord(month);
  return getMonthlyBudget(month);
}
