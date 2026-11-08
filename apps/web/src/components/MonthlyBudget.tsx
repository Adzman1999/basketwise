import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, PiggyBank, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BudgetCalendar from '@/components/BudgetCalendar';
import { philippineDateString } from '@/lib/dates';
import {
  deleteGroceryBudget,
  fetchGroceryBudget,
  saveGroceryBudget,
  type BudgetPeriod,
  type BudgetPeriodType,
  type GroceryBudgetSummary,
} from '@/lib/api';

type BudgetState =
  | { kind: 'loading' }
  | { kind: 'loaded'; summary: GroceryBudgetSummary }
  | { kind: 'error'; message: string }
  | { kind: 'invalid'; message: string };

const maxBudgetCentavos = 2_147_483_647;
const maxBudgetPesos = (maxBudgetCentavos / 100).toFixed(2);
const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

const periodOptions: { value: BudgetPeriodType; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom range' },
];

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftAnchorDate(dateValue: string, periodType: BudgetPeriodType, direction: -1 | 1): string {
  const date = parseLocalDate(dateValue);
  if (periodType === 'day') date.setDate(date.getDate() + direction);
  if (periodType === 'week') date.setDate(date.getDate() + (direction * 7));
  if (periodType === 'month') date.setMonth(date.getMonth() + direction, 1);
  if (periodType === 'year') date.setFullYear(date.getFullYear() + direction, 0, 1);
  return localDateString(date);
}

function shiftCalendarMonth(dateValue: string, direction: -1 | 1): string {
  const selectedDate = parseLocalDate(dateValue);
  const dayOfMonth = selectedDate.getDate();
  const nextMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + direction, 1);
  const lastDayOfMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  nextMonth.setDate(Math.min(dayOfMonth, lastDayOfMonth));
  return localDateString(nextMonth);
}

function resolveBudgetPeriod(
  periodType: BudgetPeriodType,
  anchorDate: string,
  customStartsOn: string,
  customEndsOn: string
): BudgetPeriod | null {
  if (periodType === 'custom') {
    if (!customStartsOn || !customEndsOn || customStartsOn > customEndsOn) return null;
    return { periodType, startsOn: customStartsOn, endsOn: customEndsOn };
  }

  if (periodType === 'day') return { periodType, startsOn: anchorDate, endsOn: anchorDate };

  const anchor = parseLocalDate(anchorDate);
  if (periodType === 'week') {
    const starts = new Date(anchor);
    starts.setDate(starts.getDate() - ((starts.getDay() + 6) % 7));
    const ends = new Date(starts);
    ends.setDate(ends.getDate() + 6);
    return { periodType, startsOn: localDateString(starts), endsOn: localDateString(ends) };
  }

  if (periodType === 'month') {
    const starts = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const ends = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { periodType, startsOn: localDateString(starts), endsOn: localDateString(ends) };
  }

  const startsOn = `${anchor.getFullYear()}-01-01`;
  return { periodType, startsOn, endsOn: `${anchor.getFullYear()}-12-31` };
}

function formatDate(dateValue: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parseLocalDate(dateValue));
}

function formatBudgetPeriod(period: BudgetPeriod): string {
  if (period.periodType === 'day') return formatDate(period.startsOn);
  if (period.periodType === 'month') {
    return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' })
      .format(parseLocalDate(period.startsOn));
  }
  if (period.periodType === 'year') return period.startsOn.slice(0, 4);
  return `${formatDate(period.startsOn)} – ${formatDate(period.endsOn)}`;
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
  const today = philippineDateString();
  const [periodType, setPeriodType] = useState<BudgetPeriodType>('month');
  const [anchorDate, setAnchorDate] = useState(today);
  const [customStartsOn, setCustomStartsOn] = useState(today);
  const [customEndsOn, setCustomEndsOn] = useState(today);
  const [refreshKey, setRefreshKey] = useState(0);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [budgetState, setBudgetState] = useState<BudgetState>({ kind: 'loading' });
  const [budgetAmount, setBudgetAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const period = useMemo(
    () => resolveBudgetPeriod(periodType, anchorDate, customStartsOn, customEndsOn),
    [periodType, anchorDate, customStartsOn, customEndsOn]
  );
  const periodError = periodType === 'custom' && (!customStartsOn || !customEndsOn)
    ? 'Choose both a start date and an end date.'
    : periodType === 'custom' && customStartsOn > customEndsOn
      ? 'The end date must be on or after the start date.'
      : '';
  const periodIsPast = Boolean(period && period.endsOn < today);

  useEffect(() => {
    if (!period) {
      setBudgetState({ kind: 'invalid', message: periodError || 'Choose a valid date range.' });
      return;
    }

    const controller = new AbortController();
    setBudgetState({ kind: 'loading' });
    setFormError('');
    setNotice('');

    void fetchGroceryBudget(period, controller.signal)
      .then((summary) => {
        if (controller.signal.aborted) return;
        setBudgetState({ kind: 'loaded', summary });
        setBudgetAmount(summary.budgetCentavos === null ? '' : (summary.budgetCentavos / 100).toFixed(2));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setBudgetState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load this grocery spending period.',
        });
      });

    return () => controller.abort();
  }, [period, periodError, refreshKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setNotice('');
    if (!period) return;
    if (periodIsPast) {
      setFormError('A budget target can only be set for today or a future period.');
      return;
    }

    const budgetCentavos = parseBudgetCentavos(budgetAmount);
    if (budgetCentavos === null) {
      setFormError(`Enter a target from ₱0.01 to ₱${maxBudgetPesos}, with up to two decimal places.`);
      return;
    }

    setIsSaving(true);
    try {
      const summary = await saveGroceryBudget(period, budgetCentavos);
      setBudgetState({ kind: 'loaded', summary });
      setBudgetAmount((summary.budgetCentavos! / 100).toFixed(2));
      setNotice(`${formatBudgetPeriod(period)} target saved.`);
      setCalendarRefreshKey((current) => current + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this grocery budget.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeBudget() {
    if (!period) return;
    setFormError('');
    setNotice('');
    setIsSaving(true);
    try {
      const summary = await deleteGroceryBudget(period);
      setBudgetState({ kind: 'loaded', summary });
      setBudgetAmount('');
      setNotice(`${formatBudgetPeriod(period)} target removed.`);
      setCalendarRefreshKey((current) => current + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not remove this grocery budget.');
    } finally {
      setIsSaving(false);
    }
  }

  function changePeriod(direction: -1 | 1) {
    if (periodType === 'custom') return;
    setAnchorDate((current) => shiftAnchorDate(current, periodType, direction));
  }

  function selectCalendarDate(date: string) {
    setPeriodType('day');
    setAnchorDate(date);
    window.requestAnimationFrame(() => {
      document.getElementById('budget-period-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
  const selectedPeriodTitle = period ? formatBudgetPeriod(period) : 'Selected dates';

  return (
    <section aria-labelledby="budget-period-title" className="space-y-5">
      <div className="space-y-1.5">
        <Badge variant="secondary" className="w-fit gap-1.5"><PiggyBank aria-hidden="true" className="size-4" /> Grocery planning</Badge>
        <h2 id="budget-period-title" className="text-2xl font-semibold tracking-tight">Spending by period</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          See receipt spending for any period. Recipe and ingredient costing can be added separately later.
        </p>
      </div>

      <div className="grid items-end gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid min-w-0 gap-2 text-sm font-medium">
          <Label htmlFor="budget-period-type">Period</Label>
          <Select value={periodType} onValueChange={(value) => setPeriodType(value as BudgetPeriodType)} disabled={isSaving}>
            <SelectTrigger id="budget-period-type" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {periodType === 'custom' ? (
          <>
            <Label htmlFor="budget-start-date" className="grid min-w-0 gap-2 text-sm font-medium">
              From
              <Input id="budget-start-date" type="date" className="h-10" value={customStartsOn} onChange={(event) => setCustomStartsOn(event.target.value)} disabled={isSaving} />
            </Label>
            <Label htmlFor="budget-end-date" className="grid min-w-0 gap-2 text-sm font-medium">
              To
              <Input id="budget-end-date" type="date" className="h-10" value={customEndsOn} onChange={(event) => setCustomEndsOn(event.target.value)} disabled={isSaving} />
            </Label>
          </>
        ) : periodType === 'month' ? (
          <Label htmlFor="budget-month" className="grid min-w-0 gap-2 text-sm font-medium">
            Month
            <Input id="budget-month" type="month" className="h-10" value={anchorDate.slice(0, 7)} onChange={(event) => {
              if (/^\d{4}-\d{2}$/.test(event.target.value)) setAnchorDate(`${event.target.value}-01`);
            }} disabled={isSaving} />
          </Label>
        ) : periodType === 'year' ? (
          <div className="grid min-w-0 gap-2 text-sm font-medium">
            <Label htmlFor="budget-year">Year</Label>
            <Select value={anchorDate.slice(0, 4)} onValueChange={(year) => setAnchorDate(`${year}-01-01`)} disabled={isSaving}>
              <SelectTrigger id="budget-year" className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 201 }, (_, index) => 1900 + index).map((year) => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : periodType === 'day' ? (
          <div className="grid min-w-0 gap-2 text-sm font-medium">
            <span>Selected date</span>
            <p className="flex h-10 items-center rounded-md border px-3 text-sm font-normal">{selectedPeriodTitle}</p>
          </div>
        ) : (
          <Label htmlFor="budget-anchor-date" className="grid min-w-0 gap-2 text-sm font-medium">
            Date in week
            <Input id="budget-anchor-date" type="date" className="h-10" value={anchorDate} onChange={(event) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setAnchorDate(event.target.value);
            }} disabled={isSaving} />
          </Label>
        )}

        {periodType !== 'custom' && periodType !== 'day' && periodType !== 'month' && (
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => changePeriod(-1)} disabled={isSaving} aria-label={`Previous ${periodType}`}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <p className="min-w-0 flex-1 truncate pb-2 text-center text-sm font-medium">{selectedPeriodTitle}</p>
            <Button type="button" variant="outline" size="icon" onClick={() => changePeriod(1)} disabled={isSaving} aria-label={`Next ${periodType}`}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {(periodType === 'day' || periodType === 'month') && (
        <BudgetCalendar
          month={anchorDate.slice(0, 7)}
          selectedDate={periodType === 'day' ? anchorDate : ''}
          onSelectDate={selectCalendarDate}
          onMonthChange={(direction) => setAnchorDate((current) => shiftCalendarMonth(current, direction))}
          refreshKey={calendarRefreshKey}
        />
      )}

      {budgetState.kind === 'loading' && (
        <div className="grid gap-5 xl:grid-cols-2" role="status" aria-label="Loading grocery spending period">
          <Card><CardContent className="space-y-4 p-5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-8 w-1/2" /><Skeleton className="h-3 w-full" /></CardContent></Card>
          <Card><CardContent className="space-y-4 p-5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-1/3" /></CardContent></Card>
        </div>
      )}

      {budgetState.kind === 'invalid' && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Check the selected dates</AlertTitle>
          <AlertDescription>{budgetState.message}</AlertDescription>
        </Alert>
      )}

      {budgetState.kind === 'error' && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Grocery spending could not load</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{budgetState.message}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setRefreshKey((current) => current + 1)}>
              <RotateCcw aria-hidden="true" /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {summary && (
        <div id="budget-period-details" className="grid min-w-0 scroll-mt-24 gap-5 xl:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader className="p-4 sm:p-5">
              <CardDescription>Grocery spending</CardDescription>
              <CardTitle className="text-lg">{formatBudgetPeriod(summary)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-4 pt-0 sm:p-5 sm:pt-0">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 rounded-lg bg-muted/40 p-3.5">
                  <p className="text-xs text-muted-foreground">Spent on groceries</p>
                  <p className="mt-1 truncate text-xl font-semibold tabular-nums">{formatCentavos(summary.spentCentavos)}</p>
                </div>
                <div className="min-w-0 rounded-lg bg-muted/40 p-3.5">
                  <p className="text-xs text-muted-foreground">Receipts</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{summary.receiptCount}</p>
                </div>
                <div className="min-w-0 rounded-lg bg-muted/40 p-3.5">
                  <p className="text-xs text-muted-foreground">{isOverBudget ? 'Over target' : 'Remaining'}</p>
                  <p className="mt-1 truncate text-xl font-semibold tabular-nums">
                    {remainingCentavos === null ? '—' : formatCentavos(Math.abs(remainingCentavos))}
                  </p>
                </div>
              </div>

              {hasBudget ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Target for this period</span>
                    <span className="font-medium tabular-nums">{formatCentavos(summary.budgetCentavos!)}</span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${formatBudgetPeriod(summary)} budget used`}
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
                  <p className="text-sm font-medium">No budget target for this period</p>
                  <p className="mt-1 text-sm text-muted-foreground">Set a target to track what remains as receipts are recorded.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="p-4 sm:p-5">
              <CardTitle className="text-lg">Budget target</CardTitle>
              <CardDescription>{selectedPeriodTitle}. Spending uses receipt totals by purchase date.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
              <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                <Label htmlFor="budget-amount" className="grid gap-2 text-sm font-medium">
                  Amount for this period
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
                      disabled={isSaving || !period || periodIsPast}
                    />
                  </div>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {periodIsPast
                    ? 'Past spending remains available to review, but targets can only be set for today or future periods.'
                    : 'Targets are saved separately for each selected period.'}
                </p>
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                {notice && <p className="text-sm text-primary" role="status">{notice}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={isSaving || !period || periodIsPast}>
                    <Save aria-hidden="true" /> {isSaving ? 'Saving…' : hasBudget ? 'Update target' : 'Set target'}
                  </Button>
                  {hasBudget && (
                    <Button type="button" variant="outline" onClick={() => void removeBudget()} disabled={isSaving || !period}>
                      <Trash2 aria-hidden="true" /> Remove target
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
