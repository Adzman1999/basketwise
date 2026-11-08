import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Lightbulb,
  Package,
  PiggyBank,
  ReceiptText,
  Store,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchGroceryBudget, fetchGroceryItems, fetchPurchases } from '@/lib/api';
import type { GroceryBudgetSummary, Purchase, PurchasePage } from '@/lib/api';
import { philippineDateString } from '@/lib/dates';

type LoadState<T> =
  | { kind: 'loading' }
  | { kind: 'loaded'; value: T }
  | { kind: 'error'; message: string };

type OverviewProps = {
  refreshKey: number;
};

type StatTone = 'green' | 'blue' | 'violet' | 'amber';

const statToneClasses: Record<StatTone, { card: string; icon: string }> = {
  green: {
    card: 'border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.045] via-card to-card',
    icon: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  blue: {
    card: 'border-sky-500/15 bg-gradient-to-br from-sky-500/[0.045] via-card to-card',
    icon: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  violet: {
    card: 'border-violet-500/15 bg-gradient-to-br from-violet-500/[0.045] via-card to-card',
    icon: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  amber: {
    card: 'border-amber-500/15 bg-gradient-to-br from-amber-500/[0.045] via-card to-card',
    icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
};

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

function formatPeso(amountCentavos: number): string {
  return pesoFormatter.format(amountCentavos / 100);
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1));
}

function formatPurchaseDate(date: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function monthPeriod(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    periodType: 'month' as const,
    startsOn: `${month}-01`,
    endsOn: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function StatCard({
  icon: Icon,
  label,
  state,
  value,
  detail,
  tone,
  href,
}: {
  icon: typeof ReceiptText;
  label: string;
  state: LoadState<unknown>;
  value: string;
  detail: string;
  tone: StatTone;
  href?: string;
}) {
  const toneClasses = statToneClasses[tone];

  return (
    <Card className={`min-w-0 transition-colors hover:border-primary/25 ${toneClasses.card}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <CardDescription>{label}</CardDescription>
          {state.kind === 'loading' ? <Skeleton className="mt-2 h-7 w-28" /> : (
            <CardTitle className="truncate text-xl tabular-nums">{state.kind === 'error' ? '—' : value}</CardTitle>
          )}
        </div>
        <span className={`rounded-lg p-2 ${toneClasses.icon}`}><Icon className="size-4" aria-hidden="true" /></span>
      </CardHeader>
      <CardContent className="flex min-h-12 items-end justify-between gap-2 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        <p className="min-w-0 text-xs leading-5 text-muted-foreground">
          {state.kind === 'error' ? state.message : detail}
        </p>
        {href && <a href={href} className="shrink-0 text-xs font-medium text-primary hover:underline">View</a>}
      </CardContent>
    </Card>
  );
}

function budgetDetail(summary: GroceryBudgetSummary): string {
  if (summary.budgetCentavos === null) return 'No target set for this month.';
  if (summary.remainingCentavos === null) return 'Target saved.';
  if (summary.remainingCentavos < 0) return `${formatPeso(Math.abs(summary.remainingCentavos))} over target`;
  if (summary.remainingCentavos === 0) return 'Monthly target reached';
  return `${formatPeso(summary.remainingCentavos)} remaining`;
}

const dailyGroceryTips = [
  {
    title: 'Check your pantry first',
    detail: 'Take a quick look at your pantry and fridge before shopping so you do not pay twice for items you already have.',
  },
  {
    title: 'Compare price per unit',
    detail: 'Compare the price per kilo, liter, or piece for similar products. A larger pack is only a deal when its unit price is lower.',
  },
  {
    title: 'Plan a few meals before making a list',
    detail: 'Choose meals that share ingredients, then add only what you need. This can cut down on extra items and food waste.',
  },
  {
    title: 'Set a limit for each grocery trip',
    detail: 'Use your weekly suggestion as a trip guide and check the receipt total before saving the purchase.',
  },
  {
    title: 'Check saved prices before you shop',
    detail: 'Review an item’s recorded price history to see what you paid before and compare changes over time.',
  },
  {
    title: 'Be thoughtful with bulk deals',
    detail: 'Buy a larger pack when the unit price is better and your household can use it before it expires.',
  },
  {
    title: 'Keep your list focused',
    detail: 'Write essentials first and group similar items together to make the trip easier to follow.',
  },
] as const;

function dailyTipFor(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000);
  return dailyGroceryTips[dayOfYear % dailyGroceryTips.length];
}

function SmartSuggestionsCard({ state, currentDate }: { state: LoadState<GroceryBudgetSummary>; currentDate: string }) {
  const [year, month, dayOfMonth] = currentDate.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1);
  const monthName = new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(new Date(year, month - 1, 1));
  const dailyTip = dailyTipFor(currentDate);

  return (
    <Card className="min-w-0 border-primary/15 bg-gradient-to-br from-primary/[0.045] via-card to-accent/30 transition-colors hover:border-primary/25">
      <CardHeader className="flex flex-row items-start gap-3 p-4 sm:p-5">
        <span className="rounded-md bg-primary/10 p-2 text-primary"><PiggyBank className="size-4" aria-hidden="true" /></span>
        <div className="min-w-0">
          <CardTitle className="text-lg">Smart suggestions</CardTitle>
          <CardDescription className="mt-1">Daily grocery tips and spending guidance for your household.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        {state.kind === 'loading' ? (
          <div className="space-y-3" role="status" aria-label="Loading smart suggestions">
            <Skeleton className="h-5 w-3/4" />
            <div className="grid grid-cols-2 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : state.kind === 'error' ? (
          <Alert variant="destructive">
            <AlertTitle>Suggestions could not load</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : state.value.budgetCentavos === null ? (
          <div className="space-y-3 rounded-md border border-dashed border-primary/15 bg-background/50 p-4">
            <div>
              <p className="text-sm font-medium">Set a monthly grocery target</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">A budget lets Basketwise suggest a daily and weekly spending pace for {monthName}.</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="#budget">Set monthly target <ArrowRight aria-hidden="true" /></a>
            </Button>
          </div>
        ) : (state.value.remainingCentavos ?? 0) < 0 ? (
          <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium">You’re {formatPeso(Math.abs(state.value.remainingCentavos ?? 0))} over this month’s target.</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Review recent receipts to plan the next grocery trip and set a target that fits your household’s needs.</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="#grocery-spending">Review purchases <ArrowRight aria-hidden="true" /></a>
            </Button>
          </div>
        ) : (state.value.remainingCentavos ?? 0) === 0 ? (
          <div className="space-y-3 rounded-md border border-dashed border-primary/15 bg-background/50 p-4">
            <div>
              <p className="text-sm font-medium">This month’s target is fully used.</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">You’ve recorded {formatPeso(state.value.spentCentavos)} against your {formatPeso(state.value.budgetCentavos)} target. Review the budget before planning another trip.</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="#budget">Review budget <ArrowRight aria-hidden="true" /></a>
            </Button>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium">You have {formatPeso(state.value.remainingCentavos ?? 0)} left for {monthName}.</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Keep upcoming grocery spending near this pace to stay within your target.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-primary/10 bg-primary/[0.045] p-3">
                <p className="text-xs text-muted-foreground">Suggested daily pace</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatPeso(Math.floor((state.value.remainingCentavos ?? 0) / daysRemaining))}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">For {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left</p>
              </div>
              <div className="rounded-lg border border-primary/10 bg-primary/[0.045] p-3">
                <p className="text-xs text-muted-foreground">Next 7 days</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatPeso(Math.floor((state.value.remainingCentavos ?? 0) * Math.min(7, daysRemaining) / daysRemaining))}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Suggested grocery cap</p>
              </div>
            </div>
            <a href="#grocery-catalog" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Compare saved item prices <ArrowRight className="size-4" aria-hidden="true" /></a>
          </>
        )}
        <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 rounded-md bg-amber-500/10 p-1.5 text-amber-700 dark:text-amber-300"><Lightbulb className="size-4" aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Today’s grocery tip</p>
              <p className="mt-1 text-sm font-medium">{dailyTip.title}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{dailyTip.detail}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Overview({ refreshKey }: OverviewProps) {
  const currentDate = philippineDateString();
  const currentMonth = currentDate.slice(0, 7);
  const [budgetState, setBudgetState] = useState<LoadState<GroceryBudgetSummary>>({ kind: 'loading' });
  const [purchaseState, setPurchaseState] = useState<LoadState<PurchasePage>>({ kind: 'loading' });
  const [catalogState, setCatalogState] = useState<LoadState<number>>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const period = monthPeriod(currentMonth);
    setBudgetState({ kind: 'loading' });
    setPurchaseState({ kind: 'loading' });
    setCatalogState({ kind: 'loading' });

    void fetchGroceryBudget(period, signal)
      .then((value) => {
        if (!signal.aborted) setBudgetState({ kind: 'loaded', value });
      })
      .catch((error: unknown) => {
        if (!signal.aborted) setBudgetState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load the monthly budget.',
        });
      });

    void fetchPurchases(1, 5, { search: '', store: '', from: '', to: '' }, signal)
      .then((value) => {
        if (!signal.aborted) setPurchaseState({ kind: 'loaded', value });
      })
      .catch((error: unknown) => {
        if (!signal.aborted) setPurchaseState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load recent purchases.',
        });
      });

    void fetchGroceryItems(1, 1, '', signal)
      .then((value) => {
        if (!signal.aborted) setCatalogState({ kind: 'loaded', value: value.total });
      })
      .catch((error: unknown) => {
        if (!signal.aborted) setCatalogState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load saved grocery items.',
        });
      });

    return () => controller.abort();
  }, [currentMonth, refreshKey]);

  const budget = budgetState.kind === 'loaded' ? budgetState.value : null;
  const receiptsThisMonth = budget?.receiptCount ?? 0;
  const targetDetail = budget ? budgetDetail(budget) : 'Monthly spending target and balance.';
  const recentPurchases = purchaseState.kind === 'loaded' ? purchaseState.value.items : [];

  return (
    <section className="space-y-6" aria-labelledby="overview-title">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Badge variant="secondary" className="w-fit gap-1.5"><CalendarDays aria-hidden="true" className="size-4" /> {formatMonth(currentMonth)}</Badge>
          <h1 id="overview-title" className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Household overview</h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">A quick look at your grocery spending, budget, and recent activity.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={PiggyBank}
          label="Grocery spend this month"
          tone="green"
          state={budgetState}
          value={formatPeso(budget?.spentCentavos ?? 0)}
          detail={`${receiptsThisMonth} ${receiptsThisMonth === 1 ? 'receipt' : 'receipts'} recorded`}
          href="#budget"
        />
        <StatCard
          icon={ReceiptText}
          label="Monthly budget target"
          tone="blue"
          state={budgetState}
          value={budget?.budgetCentavos === null || !budget ? 'Not set' : formatPeso(budget.budgetCentavos)}
          detail={targetDetail}
          href="#budget"
        />
        <StatCard
          icon={Package}
          label="Grocery items tracked"
          tone="violet"
          state={catalogState}
          value={String(catalogState.kind === 'loaded' ? catalogState.value : 0)}
          detail="Names with recorded prices"
          href="#grocery-catalog"
        />
        <StatCard
          icon={Store}
          label="All-time receipts"
          tone="amber"
          state={purchaseState}
          value={String(purchaseState.kind === 'loaded' ? purchaseState.value.total : 0)}
          detail="Saved grocery purchases"
          href="#grocery-spending"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,1fr)]">
        <Card className="min-w-0 border-sky-500/15 bg-gradient-to-br from-sky-500/[0.035] via-card to-card transition-colors hover:border-sky-500/25">
          <CardHeader className="flex flex-row items-start justify-between gap-3 p-4 sm:p-5">
            <div>
              <CardTitle className="text-lg">Recent purchases</CardTitle>
              <CardDescription className="mt-1">Your latest grocery receipts.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="#grocery-spending">View all <ArrowRight aria-hidden="true" /></a>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 p-3 pt-0 sm:p-4 sm:pt-0">
            {purchaseState.kind === 'loading' ? (
              <div className="space-y-3 p-2" role="status" aria-label="Loading recent purchases">
                {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
              </div>
            ) : purchaseState.kind === 'error' ? (
              <Alert variant="destructive">
                <AlertTitle>Recent purchases could not load</AlertTitle>
                <AlertDescription>{purchaseState.message}</AlertDescription>
              </Alert>
            ) : recentPurchases.length === 0 ? (
              <div className="rounded-md border border-dashed p-5 text-center">
                <p className="text-sm font-medium">No purchases recorded yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Your recent grocery receipts will appear here.</p>
              </div>
            ) : (
              recentPurchases.map((purchase: Purchase) => (
                <a key={purchase.id} href="#grocery-spending" className="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="rounded-md bg-muted p-2 text-muted-foreground"><ReceiptText className="size-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{purchase.storeName ?? 'Other'}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatPurchaseDate(purchase.purchasedOn)} · {purchase.items.length} {purchase.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPeso(purchase.totalPaidCentavos)}</span>
                </a>
              ))
            )}
          </CardContent>
        </Card>

        <SmartSuggestionsCard state={budgetState} currentDate={currentDate} />
      </div>
    </section>
  );
}
