ALTER TABLE monthly_budgets RENAME TO grocery_budgets;
ALTER TABLE grocery_budgets RENAME COLUMN month_start TO period_start;
ALTER TABLE grocery_budgets DROP CONSTRAINT monthly_budgets_month_start_check;
ALTER TABLE grocery_budgets DROP CONSTRAINT monthly_budgets_pkey;

ALTER TABLE grocery_budgets
  ADD COLUMN period_type VARCHAR(16) NOT NULL DEFAULT 'month',
  ADD COLUMN period_end DATE;

UPDATE grocery_budgets
SET period_end = (period_start + INTERVAL '1 month' - INTERVAL '1 day')::date;

ALTER TABLE grocery_budgets
  ALTER COLUMN period_end SET NOT NULL,
  ADD CONSTRAINT grocery_budgets_period_type_check
    CHECK (period_type IN ('day', 'week', 'month', 'year', 'custom')),
  ADD CONSTRAINT grocery_budgets_period_order_check
    CHECK (period_start <= period_end),
  ADD CONSTRAINT grocery_budgets_canonical_period_check
    CHECK (
      (period_type = 'day' AND period_start = period_end)
      OR (
        period_type = 'week'
        AND EXTRACT(ISODOW FROM period_start) = 1
        AND period_end = period_start + 6
      )
      OR (
        period_type = 'month'
        AND EXTRACT(DAY FROM period_start) = 1
        AND period_end = (period_start + INTERVAL '1 month' - INTERVAL '1 day')::date
      )
      OR (
        period_type = 'year'
        AND EXTRACT(MONTH FROM period_start) = 1
        AND EXTRACT(DAY FROM period_start) = 1
        AND EXTRACT(YEAR FROM period_start) = EXTRACT(YEAR FROM period_end)
        AND EXTRACT(MONTH FROM period_end) = 12
        AND EXTRACT(DAY FROM period_end) = 31
      )
      OR period_type = 'custom'
    ),
  ADD CONSTRAINT grocery_budgets_period_key
    PRIMARY KEY (period_type, period_start, period_end);
