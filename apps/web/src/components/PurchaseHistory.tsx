import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, LoaderCircle, ReceiptText, RotateCcw, Search, SlidersHorizontal, Store } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { Purchase, PurchaseFilters, PurchasePage } from '@/lib/api';

type PurchaseHistoryState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: PurchasePage }
  | { kind: 'error'; message: string }
  | { kind: 'invalid'; message: string };

type PurchaseHistoryProps = {
  state: PurchaseHistoryState;
  pageNumber: number;
  pageSize: number;
  filters: PurchaseFilters;
  filtersPending: boolean;
  onFiltersChange: (filters: PurchaseFilters) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
};

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

function formatCentavos(amount: number): string {
  return phpFormatter.format(amount / 100);
}

function formatPurchaseDate(date: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function PurchaseCard({ purchase }: { purchase: Purchase }) {
  return (
    <Card className="overflow-hidden p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden sm:px-5">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs text-muted-foreground">
              <time dateTime={purchase.purchasedOn}>{formatPurchaseDate(purchase.purchasedOn)}</time>
            </p>
            <CardTitle className="truncate text-base">{purchase.storeName || 'Grocery trip'}</CardTitle>
            <p className="text-xs text-muted-foreground">{purchase.items.length} {purchase.items.length === 1 ? 'item' : 'items'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Receipt total</p>
              <p className="text-base font-semibold tabular-nums">{formatCentavos(purchase.totalPaidCentavos)}</p>
            </div>
            <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </div>
        </summary>

        <CardContent className="border-t bg-muted/10 px-4 py-1 sm:px-5">
          <div className="divide-y">
            {purchase.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.itemName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.quantity} {item.unit}</p>
                </div>
                <span className="shrink-0 font-medium tabular-nums">{formatCentavos(item.amountPaidCentavos)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t py-3">
            <Badge variant={purchase.unallocatedAmountCentavos === 0 ? 'secondary' : 'outline'}>
              {purchase.unallocatedAmountCentavos === 0
                ? 'Receipt lines match total'
                : `Unallocated ${formatCentavos(purchase.unallocatedAmountCentavos)}`}
            </Badge>
          </div>
        </CardContent>
      </details>
    </Card>
  );
}

export default function PurchaseHistory({
  state,
  pageNumber,
  pageSize,
  filters,
  filtersPending,
  onFiltersChange,
  onPageChange,
  onRetry,
}: PurchaseHistoryProps) {
  const hasActiveFilters = Boolean(filters.search.trim() || filters.store.trim() || filters.from || filters.to);
  const dateRangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  const pageData = state.kind === 'loaded' && !dateRangeInvalid ? state.page : null;
  const totalPages = pageData ? Math.max(1, Math.ceil(pageData.total / pageSize)) : 1;
  function updateFilter(key: keyof PurchaseFilters, value: string) {
    onFiltersChange({ ...filters, [key]: value });
  }

  function clearFilters() {
    onFiltersChange({ search: '', store: '', from: '', to: '' });
  }

  return (
    <section aria-labelledby="purchase-history-title" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="purchase-history-title" className="text-xl font-semibold tracking-tight">Purchase history</h2>
        <div className="flex items-center gap-2">
          {filtersPending && (
            <Badge variant="secondary" className="gap-1.5">
              <LoaderCircle aria-hidden="true" className="size-3 animate-spin" /> Updating
            </Badge>
          )}
          {pageData && (
            <p className="text-sm text-muted-foreground">
              {pageData.total} {hasActiveFilters ? 'matching ' : ''}{pageData.total === 1 ? 'receipt' : 'receipts'}
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Find purchases</CardTitle>
              <CardDescription>Search item names and narrow results by store or date.</CardDescription>
            </div>
          </div>
          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={clearFilters}>
              <RotateCcw aria-hidden="true" /> Clear
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 p-4 pt-1 md:grid-cols-2 xl:grid-cols-5">
          <Label className="grid min-w-0 gap-2 text-sm font-medium md:col-span-2 xl:col-span-2">
            Search item names
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9"
                type="search"
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="e.g. rice"
                maxLength={120}
                aria-label="Search item names"
              />
            </div>
          </Label>
          <Label className="grid min-w-0 gap-2 text-sm font-medium md:col-span-2 xl:col-span-1">
            Shop or store
            <div className="relative">
              <Store aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9"
                type="search"
                value={filters.store}
                onChange={(event) => updateFilter('store', event.target.value)}
                placeholder="Filter by store"
                maxLength={120}
                aria-label="Filter by shop or store"
              />
            </div>
          </Label>
          <Label className="grid min-w-0 gap-2 text-sm font-medium">
            From
            <div className="relative">
              <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9"
                type="date"
                value={filters.from}
                onChange={(event) => updateFilter('from', event.target.value)}
                max={filters.to || undefined}
                aria-label="Start date"
              />
            </div>
          </Label>
          <Label className="grid min-w-0 gap-2 text-sm font-medium">
            To
            <div className="relative">
              <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9"
                type="date"
                value={filters.to}
                onChange={(event) => updateFilter('to', event.target.value)}
                min={filters.from || undefined}
                aria-label="End date"
              />
            </div>
          </Label>
        </CardContent>
      </Card>

      {dateRangeInvalid && (
        <Alert variant="destructive">
          <CalendarDays aria-hidden="true" />
          <AlertTitle>Check the date range</AlertTitle>
          <AlertDescription>The start date must be on or before the end date.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3" aria-live="polite" aria-busy={filtersPending || state.kind === 'loading'}>
        {state.kind === 'loading' && !dateRangeInvalid && (
          <Card role="status" aria-label="Loading purchase history">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-44" />
              <Separator />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </CardContent>
          </Card>
        )}

        {state.kind === 'error' && !dateRangeInvalid && (
          <Alert variant="destructive">
            <ReceiptText aria-hidden="true" />
            <AlertTitle>History could not load</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{state.message}</p>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button>
            </AlertDescription>
          </Alert>
        )}

        {state.kind === 'invalid' && !dateRangeInvalid && (
          <Alert variant="destructive">
            <CalendarDays aria-hidden="true" />
            <AlertTitle>Check the date range</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {pageData && pageData.items.length === 0 && !hasActiveFilters && (
          <Card>
            <CardContent className="flex flex-col items-center px-5 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ReceiptText aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">Your first receipt starts here</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Add a grocery purchase to start tracking what you spend and what each item costs.
              </p>
            </CardContent>
          </Card>
        )}

        {pageData && pageData.items.length === 0 && hasActiveFilters && (
          <Card>
            <CardContent className="flex flex-col items-center px-5 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">No matching purchases</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Try a different item, store, or date range.</p>
              <Button type="button" variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                <RotateCcw aria-hidden="true" /> Clear filters
              </Button>
            </CardContent>
          </Card>
        )}

        {pageData?.items.map((purchase) => <PurchaseCard key={purchase.id} purchase={purchase} />)}
      </div>

      {pageData && pageData.total > 0 && totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Purchase history pages">
          <Button variant="outline" size="sm" onClick={() => onPageChange(pageNumber - 1)} disabled={pageNumber <= 1 || state.kind === 'loading' || filtersPending}>
            <ArrowLeft aria-hidden="true" /> Previous
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">Page {pageNumber} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => onPageChange(pageNumber + 1)} disabled={pageNumber >= totalPages || state.kind === 'loading' || filtersPending}>
            Next <ArrowRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </section>
  );
}

export type { PurchaseHistoryState };
