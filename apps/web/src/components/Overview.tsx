import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CirclePlus,
  Package,
  PiggyBank,
  ReceiptText,
  Store,
  Tags,
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
  onAddPurchase: () => void;
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
  href,
}: {
  icon: typeof ReceiptText;
  label: string;
  state: LoadState<unknown>;
  value: string;
  detail: string;
  href?: string;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <CardDescription>{label}</CardDescription>
          {state.kind === 'loading' ? <Skeleton className="mt-2 h-7 w-28" /> : (
            <CardTitle className="truncate text-xl tabular-nums">{state.kind === 'error' ? '—' : value}</CardTitle>
          )}
        </div>
        <span className="rounded-md bg-muted p-2 text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span>
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

function QuickLink({ href, icon: Icon, title, description }: {
  href: string;
  icon: typeof ReceiptText;
  title: string;
  description: string;
}) {
  return (
    <a href={href} className="group flex min-w-0 items-center gap-3 rounded-md p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="rounded-md border bg-background p-2 text-muted-foreground group-hover:text-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </a>
  );
}

function budgetDetail(summary: GroceryBudgetSummary): string {
  if (summary.budgetCentavos === null) return 'No target set for this month.';
  if (summary.remainingCentavos === null) return 'Target saved.';
  if (summary.remainingCentavos < 0) return `${formatPeso(Math.abs(summary.remainingCentavos))} over target`;
  if (summary.remainingCentavos === 0) return 'Monthly target reached';
  return `${formatPeso(summary.remainingCentavos)} remaining`;
}

export default function Overview({ refreshKey, onAddPurchase }: OverviewProps) {
  const currentMonth = philippineDateString().slice(0, 7);
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
          <Badge variant="secondary" className="w-fit gap-1.5"><CalendarDays aria-hidden="true" /> {formatMonth(currentMonth)}</Badge>
          <h1 id="overview-title" className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Household overview</h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">A quick look at your grocery spending, budget, and recent activity.</p>
        </div>
        <Button onClick={onAddPurchase}>
          <CirclePlus aria-hidden="true" /> Add a purchase
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={PiggyBank}
          label="Grocery spend this month"
          state={budgetState}
          value={formatPeso(budget?.spentCentavos ?? 0)}
          detail={`${receiptsThisMonth} ${receiptsThisMonth === 1 ? 'receipt' : 'receipts'} recorded`}
          href="#budget"
        />
        <StatCard
          icon={ReceiptText}
          label="Monthly budget target"
          state={budgetState}
          value={budget?.budgetCentavos === null || !budget ? 'Not set' : formatPeso(budget.budgetCentavos)}
          detail={targetDetail}
          href="#budget"
        />
        <StatCard
          icon={Package}
          label="Grocery items tracked"
          state={catalogState}
          value={String(catalogState.kind === 'loaded' ? catalogState.value : 0)}
          detail="Names with recorded prices"
          href="#grocery-catalog"
        />
        <StatCard
          icon={Store}
          label="All-time receipts"
          state={purchaseState}
          value={String(purchaseState.kind === 'loaded' ? purchaseState.value.total : 0)}
          detail="Saved grocery purchases"
          href="#grocery-spending"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,1fr)]">
        <Card className="min-w-0">
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
                <p className="mt-1 text-xs text-muted-foreground">Add a receipt to start building your grocery history.</p>
                <Button className="mt-3" size="sm" onClick={onAddPurchase}><CirclePlus aria-hidden="true" /> Add a purchase</Button>
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

        <Card className="min-w-0">
          <CardHeader className="p-4 sm:p-5">
            <CardTitle className="text-lg">Quick links</CardTitle>
            <CardDescription>Jump to the parts of Basketwise you use most.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 p-2 pt-0 sm:p-3 sm:pt-0">
            <QuickLink href="#grocery-spending" icon={ReceiptText} title="Grocery spending" description="Receipts, search, and filters" />
            <QuickLink href="#budget" icon={PiggyBank} title="Budget & spending" description="Targets and calendar totals" />
            <QuickLink href="#grocery-catalog" icon={Tags} title="Items & prices" description="Browse grocery price history" />
            <QuickLink href="#stores" icon={Store} title="Stores & shops" description="Manage saved places" />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
