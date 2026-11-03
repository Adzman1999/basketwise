import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { philippineDateString } from '@/lib/dates';
import {
  fetchGroceryBudgetCalendar,
  type BudgetCalendarDayStatus,
  type GroceryBudgetCalendar,
  type GroceryBudgetCalendarDay,
} from '@/lib/api';

type BudgetCalendarProps = {
  month: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onMonthChange: (direction: -1 | 1) => void;
  refreshKey: number;
};

type CalendarState =
  | { kind: 'loading' }
  | { kind: 'loaded'; calendar: GroceryBudgetCalendar }
  | { kind: 'error'; message: string };

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const statusLabels: Record<BudgetCalendarDayStatus, string> = {
  no_target: 'No daily target',
  remaining: 'Budget remaining',
  at_limit: 'At the target limit',
  exceeded: 'Target exceeded',
};
const statusDotClasses: Record<BudgetCalendarDayStatus, string> = {
  no_target: 'bg-muted-foreground/40',
  remaining: 'bg-primary',
  at_limit: 'bg-amber-500',
  exceeded: 'bg-destructive',
};

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const compactPesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatPeso(amountCentavos: number): string {
  return pesoFormatter.format(amountCentavos / 100);
}

function formatCompactPeso(amountCentavos: number): string {
  return compactPesoFormatter.format(amountCentavos / 100);
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1));
}

function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parseLocalDate(date));
}

function budgetUsagePercent(day: GroceryBudgetCalendarDay): number | null {
  if (day.budgetCentavos === null) return null;
  if (day.status === 'at_limit') return 100;
  const percent = Math.round((day.spentCentavos / day.budgetCentavos) * 100);
  if (day.status === 'exceeded') return Math.max(101, percent);
  return Math.min(99, percent);
}

function dayDescription(day: GroceryBudgetCalendarDay): string {
  const spend = `Spent ${formatPeso(day.spentCentavos)} across ${day.receiptCount} ${day.receiptCount === 1 ? 'receipt' : 'receipts'}`;
  if (day.budgetCentavos === null) return `${statusLabels[day.status]}. ${spend}.`;
  const percentUsed = budgetUsagePercent(day);
  const balance = day.remainingCentavos! < 0
    ? `Over by ${formatPeso(Math.abs(day.remainingCentavos!))}`
    : day.remainingCentavos === 0
      ? 'No budget remains'
      : `${formatPeso(day.remainingCentavos!)} remains`;
  return `${statusLabels[day.status]}. Target ${formatPeso(day.budgetCentavos)}. ${percentUsed}% used. ${spend}. ${balance}.`;
}

function StatusLegend({ status }: { status: BudgetCalendarDayStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-2 rounded-full ${statusDotClasses[status]}`} aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}

export default function BudgetCalendar({ month, selectedDate, onSelectDate, onMonthChange, refreshKey }: BudgetCalendarProps) {
  const today = philippineDateString();
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const [calendarState, setCalendarState] = useState<CalendarState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setCalendarState({ kind: 'loading' });
    void fetchGroceryBudgetCalendar(month, controller.signal)
      .then((calendar) => {
        if (!controller.signal.aborted) setCalendarState({ kind: 'loaded', calendar });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCalendarState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load this month’s daily budgets.',
        });
      });

    return () => controller.abort();
  }, [month, refreshKey, refreshAttempt]);

  const daysByDate = useMemo(() => {
    const days = calendarState.kind === 'loaded' ? calendarState.calendar.days : [];
    return new Map(days.map((day) => [day.date, day]));
  }, [calendarState]);
  const monthTotals = useMemo(() => {
    if (calendarState.kind !== 'loaded') return null;
    return calendarState.calendar.days.reduce(
      (totals, day) => ({
        spentCentavos: totals.spentCentavos + day.spentCentavos,
        receiptCount: totals.receiptCount + day.receiptCount,
      }),
      { spentCentavos: 0, receiptCount: 0 }
    );
  }, [calendarState]);

  const dateCells = useMemo(() => {
    const [year, monthNumber] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const leadingBlanks = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
    const cellCount = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

    return Array.from({ length: cellCount }, (_, index) => {
      const dayNumber = index - leadingBlanks + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      return `${month}-${String(dayNumber).padStart(2, '0')}`;
    });
  }, [month]);

  return (
    <Card aria-label="Daily grocery budget calendar">
      <CardHeader className="gap-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">Daily budget calendar</CardTitle>
            <CardDescription className="mt-1">{formatMonth(month)} · Choose a date to see its full spending details below.</CardDescription>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="outline" size="icon" onClick={() => onMonthChange(-1)} aria-label="Previous calendar month">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => onMonthChange(1)} aria-label="Next calendar month">
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Each date shows its target, daily grocery total, and percent used. The dot marks budget status.</p>
      </CardHeader>
      <CardContent className="space-y-4 p-3 pt-0 sm:p-5 sm:pt-0">
        {calendarState.kind === 'error' && (
          <Alert variant="destructive">
            <AlertTitle>Calendar details could not load</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{calendarState.message}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setRefreshAttempt((attempt) => attempt + 1)}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Grand total this month</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {monthTotals
                ? `${monthTotals.receiptCount} ${monthTotals.receiptCount === 1 ? 'receipt' : 'receipts'}`
                : calendarState.kind === 'loading' ? 'Loading receipt totals…' : 'Receipt totals unavailable'}
            </p>
          </div>
          {monthTotals ? (
            <output className="shrink-0 text-base font-semibold tabular-nums sm:text-lg">
              {formatPeso(monthTotals.spentCentavos)}
            </output>
          ) : calendarState.kind === 'loading' ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <span className="shrink-0 text-base font-semibold text-muted-foreground">—</span>
          )}
        </div>

        <div className="grid grid-cols-7 border-l border-t" aria-busy={calendarState.kind === 'loading'}>
          {weekdays.map((weekday) => (
            <div key={weekday} className="border-b border-r bg-muted/30 py-2 text-center text-[10px] font-medium text-muted-foreground sm:text-xs">{weekday}</div>
          ))}
          {dateCells.map((date, index) => {
            if (!date) return <div key={`blank-${index}`} className="min-h-[78px] border-b border-r bg-muted/10 sm:min-h-[112px]" aria-hidden="true" />;

            const day = daysByDate.get(date);
            const isSelected = date === selectedDate;
            const isToday = date === today;
            const hasBudget = day?.budgetCentavos !== null && day?.budgetCentavos !== undefined;
            const description = day ? dayDescription(day) : formatLongDate(date);
            const status = day?.status ?? 'no_target';
            const percentUsed = day ? budgetUsagePercent(day) : null;
            const hasIndicator = Boolean(day && (day.budgetCentavos !== null || day.spentCentavos > 0));
            const statusTextClass = status === 'exceeded'
              ? 'text-destructive'
              : status === 'at_limit'
                ? 'text-amber-600 dark:text-amber-400'
                : status === 'remaining'
                  ? 'text-primary'
                  : 'text-muted-foreground';

            return (
              <Button
                key={date}
                type="button"
                variant="ghost"
                onClick={() => onSelectDate(date)}
                aria-pressed={isSelected}
                aria-label={`${formatLongDate(date)}. ${description}`}
                title={description}
                className={`h-auto min-h-[78px] min-w-0 flex-col items-stretch justify-start gap-1.5 rounded-none border-b border-r p-1.5 text-left font-normal hover:bg-muted/40 sm:min-h-[112px] sm:p-2 ${day?.budgetCentavos !== null && day?.budgetCentavos !== undefined ? 'bg-primary/5' : 'bg-background'} ${isSelected ? 'relative z-10 bg-primary/10 ring-2 ring-inset ring-primary hover:bg-primary/10' : ''}`}
              >
                <span className="flex w-full items-center justify-between">
                  <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums sm:size-7 sm:text-sm ${isSelected ? 'bg-primary text-primary-foreground' : isToday ? 'ring-1 ring-primary text-primary' : 'text-foreground'}`}>
                    {Number(date.slice(-2))}
                  </span>
                  {calendarState.kind === 'loaded' && hasIndicator && (
                    <span className={`size-2 shrink-0 rounded-full ${statusDotClasses[status]}`} aria-hidden="true" />
                  )}
                </span>
                {calendarState.kind === 'loading' ? (
                  <div className="w-full space-y-1.5 pt-1">
                    <Skeleton className="h-2.5 w-4/5" />
                    <Skeleton className="h-2 w-3/4" />
                    <Skeleton className="h-2 w-3/5" />
                  </div>
                ) : day && hasBudget ? (
                  <div className="w-full min-w-0 space-y-0.5 text-left leading-tight">
                    <p className="truncate text-[9px] font-medium tabular-nums text-foreground sm:text-xs">
                      <span className="hidden sm:inline">Target </span>{formatCompactPeso(day.budgetCentavos!)}
                    </p>
                    <p className="truncate text-[9px] tabular-nums text-muted-foreground sm:text-[11px]">
                      <span className="hidden sm:inline">Spent </span>{formatCompactPeso(day.spentCentavos)}
                    </p>
                    <p className={`truncate text-[9px] tabular-nums sm:text-[11px] ${statusTextClass}`}>
                      {percentUsed}% used
                    </p>
                  </div>
                ) : day ? (
                  <div className="w-full min-w-0 space-y-0.5 text-left leading-tight">
                    <p className="truncate text-[9px] font-medium tabular-nums text-foreground sm:text-xs">
                      <span className="hidden sm:inline">Spent </span>{formatCompactPeso(day.spentCentavos)}
                    </p>
                    <p className="truncate text-[9px] text-muted-foreground sm:text-[11px]">
                      {day.receiptCount > 0 ? `${day.receiptCount} ${day.receiptCount === 1 ? 'receipt' : 'receipts'}` : 'No target'}
                    </p>
                  </div>
                ) : (
                  <span className="h-8 w-full" aria-hidden="true" />
                )}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-[11px] text-muted-foreground sm:text-xs">
          <StatusLegend status="remaining" />
          <StatusLegend status="at_limit" />
          <StatusLegend status="exceeded" />
          <StatusLegend status="no_target" />
        </div>
      </CardContent>
    </Card>
  );
}
