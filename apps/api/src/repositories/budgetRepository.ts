import { query } from '../db';
import type { BudgetPeriod, SetBudgetInput } from '../schemas/budget';

export type BudgetRecord = BudgetPeriod & {
  budgetCentavos: number | null;
  spentCentavos: number;
  receiptCount: number;
};

export type BudgetCalendarRecord = {
  date: string;
  budgetCentavos: number | null;
  spentCentavos: number;
  receiptCount: number;
};

export async function getBudgetCalendarRecords(month: string): Promise<BudgetCalendarRecord[]> {
  const result = await query<{
    date: string;
    budgetCentavos: number | null;
    spentCentavos: string;
    receiptCount: string;
  }>(
    `WITH calendar_days AS (
       SELECT generated_date::date AS purchase_date
       FROM generate_series(
         $1::date,
         ($1::date + INTERVAL '1 month' - INTERVAL '1 day')::date,
         INTERVAL '1 day'
       ) AS generated_dates(generated_date)
     ), daily_spending AS (
       SELECT purchased_on,
              SUM(total_paid_centavos) AS total_centavos,
              COUNT(*) AS receipt_count
       FROM purchases
       WHERE purchased_on >= $1::date
         AND purchased_on < $1::date + INTERVAL '1 month'
       GROUP BY purchased_on
     )
     SELECT calendar_days.purchase_date::text AS date,
            budget.budget_centavos AS "budgetCentavos",
            COALESCE(daily_spending.total_centavos, 0)::text AS "spentCentavos",
            COALESCE(daily_spending.receipt_count, 0)::text AS "receiptCount"
     FROM calendar_days
     LEFT JOIN grocery_budgets budget
       ON budget.period_type = 'day'
      AND budget.period_start = calendar_days.purchase_date
      AND budget.period_end = calendar_days.purchase_date
     LEFT JOIN daily_spending
       ON daily_spending.purchased_on = calendar_days.purchase_date
     ORDER BY calendar_days.purchase_date`,
    [`${month}-01`]
  );

  return result.rows.map((row) => ({
    date: row.date,
    budgetCentavos: row.budgetCentavos,
    spentCentavos: Number(row.spentCentavos),
    receiptCount: Number(row.receiptCount),
  }));
}

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
