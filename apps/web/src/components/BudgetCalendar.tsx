import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

function dayDescription(day: GroceryBudgetCalendarDay): string {
  const spend = `Spent ${formatPeso(day.spentCentavos)} across ${day.receiptCount} ${day.receiptCount === 1 ? 'receipt' : 'receipts'}`;
  if (day.budgetCentavos === null) return `${statusLabels[day.status]}. ${spend}.`;
  const balance = day.remainingCentavos! < 0
    ? `Over by ${formatPeso(Math.abs(day.remainingCentavos!))}`
    : day.remainingCentavos === 0
      ? 'No budget remains'
      : `${formatPeso(day.remainingCentavos!)} remains`;
  return `${statusLabels[day.status]}. Target ${formatPeso(day.budgetCentavos)}. ${spend}. ${balance}.`;
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
        <p className="text-xs text-muted-foreground">Each date shows its target amount, or spend when no target is set. The dot shows the target status.</p>
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

        <div className="grid grid-cols-7 gap-1 sm:gap-2" aria-busy={calendarState.kind === 'loading'}>
          {weekdays.map((weekday) => (
            <div key={weekday} className="pb-1 text-center text-[10px] font-medium text-muted-foreground sm:text-xs">{weekday}</div>
          ))}
          {dateCells.map((date, index) => {
            if (!date) return <div key={`blank-${index}`} aria-hidden="true" />;

            const day = daysByDate.get(date);
            const isSelected = date === selectedDate;
            const amount = day?.budgetCentavos ?? (day && day.spentCentavos > 0 ? day.spentCentavos : null);
            const description = day ? dayDescription(day) : formatLongDate(date);
            const status = day?.status ?? 'no_target';

            return (
              <Button
                key={date}
                type="button"
                variant="ghost"
                onClick={() => onSelectDate(date)}
                aria-pressed={isSelected}
                aria-label={`${formatLongDate(date)}. ${description}`}
                title={description}
                className={`h-[68px] min-w-0 flex-col items-stretch justify-between gap-1 rounded-md border p-1.5 text-left font-normal hover:border-border sm:h-[82px] sm:p-2 ${isSelected ? 'border-primary bg-primary/10 hover:bg-primary/10' : 'border-transparent'}`}
              >
                <span className="flex w-full items-center justify-between text-xs font-medium tabular-nums sm:text-sm">
                  {Number(date.slice(-2))}
                  {calendarState.kind === 'loaded' && (
                    <span className={`size-2 shrink-0 rounded-full ${statusDotClasses[status]}`} aria-hidden="true" />
                  )}
                </span>
                <span className="w-full truncate text-[9px] leading-tight text-muted-foreground sm:text-[11px]">
                  {calendarState.kind === 'loading' ? <Skeleton className="h-2.5 w-4/5" /> : amount === null ? '—' : formatCompactPeso(amount)}
                </span>
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
