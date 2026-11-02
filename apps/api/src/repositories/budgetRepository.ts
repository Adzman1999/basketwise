import { query } from '../db';
import type { BudgetPeriod, SetBudgetInput } from '../schemas/budget';

export type BudgetRecord = BudgetPeriod & {
  budgetCentavos: number | null;
  spentCentavos: number;
  receiptCount: number;
};

export async function getBudgetRecord(period: BudgetPeriod): Promise<BudgetRecord> {
  const result = await query<{
    budgetCentavos: number | null;
    spentCentavos: string;
    receiptCount: string;
  }>(
    `SELECT budget.budget_centavos AS "budgetCentavos",
            COALESCE(spending.total_centavos, 0)::text AS "spentCentavos",
            COALESCE(spending.receipt_count, 0)::text AS "receiptCount"
     FROM (
       SELECT $1::varchar AS period_type, $2::date AS period_start, $3::date AS period_end
     ) requested
     LEFT JOIN grocery_budgets budget
       ON budget.period_type = requested.period_type
      AND budget.period_start = requested.period_start
      AND budget.period_end = requested.period_end
     LEFT JOIN LATERAL (
       SELECT SUM(total_paid_centavos) AS total_centavos, COUNT(*) AS receipt_count
       FROM purchases
       WHERE purchased_on >= requested.period_start
         AND purchased_on <= requested.period_end
     ) spending ON TRUE`,
    [period.periodType, period.startsOn, period.endsOn]
  );

  return {
    ...period,
    budgetCentavos: result.rows[0]?.budgetCentavos ?? null,
    spentCentavos: Number(result.rows[0]?.spentCentavos ?? '0'),
    receiptCount: Number(result.rows[0]?.receiptCount ?? '0'),
  };
}

export async function saveBudgetRecord(period: BudgetPeriod, input: SetBudgetInput): Promise<void> {
  await query(
    `INSERT INTO grocery_budgets (period_type, period_start, period_end, budget_centavos)
     VALUES ($1, $2::date, $3::date, $4)
     ON CONFLICT (period_type, period_start, period_end)
     DO UPDATE SET budget_centavos = EXCLUDED.budget_centavos,
                   updated_at = NOW()`,
    [period.periodType, period.startsOn, period.endsOn, input.budgetCentavos]
  );
}

export async function deleteBudgetRecord(period: BudgetPeriod): Promise<void> {
  await query(
    `DELETE FROM grocery_budgets
     WHERE period_type = $1 AND period_start = $2::date AND period_end = $3::date`,
    [period.periodType, period.startsOn, period.endsOn]
  );
}
