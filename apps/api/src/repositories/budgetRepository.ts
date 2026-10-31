import { query } from '../db';
import type { SetMonthlyBudgetInput } from '../schemas/budget';

export type MonthlyBudgetRecord = {
  month: string;
  budgetCentavos: number | null;
  spentCentavos: number;
};

function monthStart(month: string): string {
  return `${month}-01`;
}

export async function getMonthlyBudgetRecord(month: string): Promise<MonthlyBudgetRecord> {
  const result = await query<{
    budgetCentavos: number | null;
    spentCentavos: string;
  }>(
    `SELECT budget.budget_centavos AS "budgetCentavos",
            COALESCE(spending.total_centavos, 0)::text AS "spentCentavos"
     FROM (SELECT $1::date AS month_start) requested
     LEFT JOIN monthly_budgets budget
       ON budget.month_start = requested.month_start
     LEFT JOIN LATERAL (
       SELECT SUM(total_paid_centavos) AS total_centavos
       FROM purchases
       WHERE purchased_on >= requested.month_start
         AND purchased_on < requested.month_start + INTERVAL '1 month'
     ) spending ON TRUE`,
    [monthStart(month)]
  );

  return {
    month,
    budgetCentavos: result.rows[0]?.budgetCentavos ?? null,
    spentCentavos: Number(result.rows[0]?.spentCentavos ?? '0'),
  };
}

export async function saveMonthlyBudgetRecord(month: string, input: SetMonthlyBudgetInput): Promise<void> {
  await query(
    `INSERT INTO monthly_budgets (month_start, budget_centavos)
     VALUES ($1::date, $2)
     ON CONFLICT (month_start)
     DO UPDATE SET budget_centavos = EXCLUDED.budget_centavos,
                   updated_at = NOW()`,
    [monthStart(month), input.budgetCentavos]
  );
}

export async function deleteMonthlyBudgetRecord(month: string): Promise<void> {
  await query('DELETE FROM monthly_budgets WHERE month_start = $1::date', [monthStart(month)]);
}
