import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, PiggyBank, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteMonthlyBudget, fetchMonthlyBudget, saveMonthlyBudget, type MonthlyBudgetSummary } from '@/lib/api';

type BudgetState =
  | { kind: 'loading' }
  | { kind: 'loaded'; summary: MonthlyBudgetSummary }
  | { kind: 'error'; message: string };

const maxBudgetCentavos = 2_147_483_647;
const maxBudgetPesos = (maxBudgetCentavos / 100).toFixed(2);
const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

function currentMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(month: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

function formatCentavos(amount: number): string {
  return pesoFormatter.format(amount / 100);
}

function parseBudgetCentavos(value: string): number | null {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const centavos = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (centavos <= 0n || centavos > BigInt(maxBudgetCentavos)) return null;
  return Number(centavos);
}

export default function MonthlyBudget() {
  const [month, setMonth] = useState(currentMonth);
  const [refreshKey, setRefreshKey] = useState(0);
  const [budgetState, setBudgetState] = useState<BudgetState>({ kind: 'loading' });
  const [budgetAmount, setBudgetAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setBudgetState({ kind: 'loading' });
    setFormError('');
    setNotice('');

    void fetchMonthlyBudget(month, controller.signal)
      .then((summary) => {
        if (controller.signal.aborted) return;
        setBudgetState({ kind: 'loaded', summary });
        setBudgetAmount(summary.budgetCentavos === null ? '' : (summary.budgetCentavos / 100).toFixed(2));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setBudgetState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load this monthly budget.',
        });
      });

    return () => controller.abort();
  }, [month, refreshKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setNotice('');

    const budgetCentavos = parseBudgetCentavos(budgetAmount);
    if (budgetCentavos === null) {
      setFormError(`Enter a budget from ₱0.01 to ₱${maxBudgetPesos}, with up to two decimal places.`);
      return;
    }

    setIsSaving(true);
    try {
      const summary = await saveMonthlyBudget(month, budgetCentavos);
      setBudgetState({ kind: 'loaded', summary });
      setBudgetAmount((summary.budgetCentavos! / 100).toFixed(2));
      setNotice(`${formatMonth(month)} budget saved.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this monthly budget.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeBudget() {
    setFormError('');
    setNotice('');
    setIsSaving(true);
    try {
      const summary = await deleteMonthlyBudget(month);
      setBudgetState({ kind: 'loaded', summary });
      setBudgetAmount('');
      setNotice(`${formatMonth(month)} budget removed.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not remove this monthly budget.');
    } finally {
      setIsSaving(false);
    }
  }

  const summary = budgetState.kind === 'loaded' ? budgetState.summary : null;
  const budgetCentavos = summary?.budgetCentavos ?? null;
  const hasBudget = budgetCentavos !== null;
  const remainingCentavos = summary?.remainingCentavos ?? null;
  const percentSpent = summary && budgetCentavos !== null
    ? Math.round((summary.spentCentavos / budgetCentavos) * 100)
    : 0;
  const progressWidth = Math.max(0, Math.min(100, percentSpent));
  const isOverBudget = remainingCentavos !== null && remainingCentavos < 0;

  return (
    <section aria-labelledby="monthly-budget-title" className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Badge variant="secondary" className="w-fit gap-1.5"><PiggyBank aria-hidden="true" /> Planning</Badge>
          <h2 id="monthly-budget-title" className="text-2xl font-semibold tracking-tight">Monthly grocery budget</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Set one spending target for the month and track it against your saved receipts.
          </p>
        </div>
        <Label htmlFor="budget-month" className="grid w-full max-w-xs gap-2 text-sm font-medium">
          Month
          <Input
            id="budget-month"
            type="month"
            value={month}
            onChange={(event) => {
              if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value);
            }}
          />
        </Label>
      </div>

      {budgetState.kind === 'loading' && (
        <div className="grid gap-5 xl:grid-cols-2" role="status" aria-label="Loading monthly budget">
          <Card><CardContent className="space-y-4 p-5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-8 w-1/2" /><Skeleton className="h-3 w-full" /></CardContent></Card>
          <Card><CardContent className="space-y-4 p-5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-1/3" /></CardContent></Card>
        </div>
      )}

      {budgetState.kind === 'error' && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Monthly budget could not load</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{budgetState.message}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setRefreshKey((current) => current + 1)}>
              <RotateCcw aria-hidden="true" /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {summary && (
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader className="p-4 sm:p-5">
              <CardDescription>Grocery spending</CardDescription>
              <CardTitle className="text-lg">{formatMonth(summary.month)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-4 pt-0 sm:p-5 sm:pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0 rounded-lg bg-muted/40 p-3.5">
                  <p className="text-xs text-muted-foreground">Spent this month</p>
                  <p className="mt-1 truncate text-xl font-semibold tabular-nums">{formatCentavos(summary.spentCentavos)}</p>
                </div>
                <div className="min-w-0 rounded-lg bg-muted/40 p-3.5">
                  <p className="text-xs text-muted-foreground">{isOverBudget ? 'Over budget' : 'Remaining'}</p>
                  <p className="mt-1 truncate text-xl font-semibold tabular-nums">
                    {remainingCentavos === null ? '—' : formatCentavos(Math.abs(remainingCentavos))}
                  </p>
                </div>
              </div>

              {hasBudget ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Budget target</span>
                    <span className="font-medium tabular-nums">{formatCentavos(summary.budgetCentavos!)}</span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${formatMonth(summary.month)} budget used`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressWidth}
                    aria-valuetext={`${formatCentavos(summary.spentCentavos)} spent of ${formatCentavos(summary.budgetCentavos!)} (${percentSpent}%)`}
                  >
                    <div
                      className={`h-full rounded-full transition-[width] ${isOverBudget ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {percentSpent}% used{isOverBudget ? ' · spending is above this target' : ''}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4">
                  <p className="text-sm font-medium">No budget set for {formatMonth(summary.month)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Choose a target to see how much is left as receipts are recorded.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="p-4 sm:p-5">
              <CardTitle className="text-lg">Monthly target</CardTitle>
              <CardDescription>Spending is counted by each receipt’s purchase date.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
              <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                <Label htmlFor="budget-amount" className="grid gap-2 text-sm font-medium">
                  Budget amount
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">₱</span>
                    <Input
                      id="budget-amount"
                      className="h-10 pl-8"
                      type="number"
                      min="0.01"
                      max={maxBudgetPesos}
                      step="0.01"
                      inputMode="decimal"
                      value={budgetAmount}
                      onChange={(event) => setBudgetAmount(event.target.value)}
                      placeholder="0.00"
                      required
                      disabled={isSaving}
                    />
                  </div>
                </Label>
                <p className="text-xs text-muted-foreground">Enter an amount in pesos. The saved target can be changed or removed at any time.</p>
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                {notice && <p className="text-sm text-primary" role="status">{notice}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={isSaving}>
                    <Save aria-hidden="true" /> {isSaving ? 'Saving…' : hasBudget ? 'Update budget' : 'Set budget'}
                  </Button>
                  {hasBudget && (
                    <Button type="button" variant="outline" onClick={() => void removeBudget()} disabled={isSaving}>
                      <Trash2 aria-hidden="true" /> Remove budget
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
