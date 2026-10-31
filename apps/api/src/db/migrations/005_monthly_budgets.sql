CREATE TABLE monthly_budgets (
  month_start DATE PRIMARY KEY CHECK (EXTRACT(DAY FROM month_start) = 1),
  budget_centavos INTEGER NOT NULL CHECK (budget_centavos BETWEEN 1 AND 2147483647),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
