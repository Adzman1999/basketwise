import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, LoaderCircle, ReceiptText, RotateCcw, Search, SlidersHorizontal, Store } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { Purchase, PurchaseFilterOptions, PurchasePage } from '@/lib/api';

type PurchaseHistoryState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: PurchasePage }
  | { kind: 'error'; message: string }
  | { kind: 'invalid'; message: string };

type PurchaseHistoryProps = {
  state: PurchaseHistoryState;
  pageNumber: number;
  pageSize: number;
  filters: PurchaseFilterOptions;
  appliedFilters: PurchaseFilterOptions;
  itemSearch: string;
  appliedSearch: string;
  filtersPending: boolean;
  searchPending: boolean;
  onFiltersChange: (filters: PurchaseFilterOptions) => void;
  onItemSearchChange: (search: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onClearSearch: () => void;
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

function formatReceiptCount(total: number, pageNumber: number, pageSize: number, isFiltered: boolean): string {
  const noun = `${isFiltered ? 'matching ' : ''}${total === 1 ? 'receipt' : 'receipts'}`;
  if (total === 0) return `0 ${noun}`;
  if (total <= pageSize) return `Showing ${total} ${noun}`;

  const firstReceipt = (pageNumber - 1) * pageSize + 1;
  const lastReceipt = Math.min(pageNumber * pageSize, total);
  return `Showing ${firstReceipt}–${lastReceipt} of ${total} ${noun}`;
}

function HighlightedMatch({ name, query }: { name: string; query: string }) {
  const normalizedQuery = query.trim();
  const index = name.toLowerCase().indexOf(normalizedQuery.toLowerCase());
  if (!normalizedQuery || index < 0) return <>{name}</>;

  return (
    <>
      {name.slice(0, index)}
      <mark className="rounded bg-primary/20 px-0.5 text-foreground">{name.slice(index, index + normalizedQuery.length)}</mark>
      {name.slice(index + normalizedQuery.length)}
    </>
  );
}

function PurchaseCard({ purchase, searchQuery }: { purchase: Purchase; searchQuery: string }) {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchingItems = normalizedSearch
    ? purchase.items.filter((item) => item.itemName.toLowerCase().includes(normalizedSearch))
    : [];

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
            {matchingItems[0] && (
              <div className="flex min-w-0 items-center gap-1.5 pt-1">
                <p className="truncate text-xs font-medium">
                  <HighlightedMatch name={matchingItems[0].itemName} query={searchQuery} />
                </p>
                <Badge className="shrink-0" variant={matchingItems[0].itemName.trim().toLowerCase() === normalizedSearch ? 'default' : 'outline'}>
                  {matchingItems[0].itemName.trim().toLowerCase() === normalizedSearch ? 'Exact match' : 'Close match'}
                </Badge>
                {matchingItems.length > 1 && <span className="shrink-0 text-xs text-muted-foreground">+{matchingItems.length - 1}</span>}
              </div>
            )}
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
                  <p className="truncate font-medium"><HighlightedMatch name={item.itemName} query={searchQuery} /></p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.quantity} {item.unit}</p>
                  {normalizedSearch && item.itemName.toLowerCase().includes(normalizedSearch) && (
                    <Badge className="mt-1 h-5 px-1.5 text-[10px]" variant={item.itemName.trim().toLowerCase() === normalizedSearch ? 'default' : 'outline'}>
                      {item.itemName.trim().toLowerCase() === normalizedSearch ? 'Exact match' : 'Close match'}
                    </Badge>
                  )}
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
  appliedFilters,
  itemSearch,
  appliedSearch,
  filtersPending,
  searchPending,
  onFiltersChange,
  onItemSearchChange,
  onApplyFilters,
  onClearFilters,
  onClearSearch,
  onPageChange,
  onRetry,
}: PurchaseHistoryProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersPopoverRef = useRef<HTMLDivElement>(null);
  const draftFilterCount = [filters.store.trim(), filters.from, filters.to].filter(Boolean).length;
  const appliedFilterCount = [appliedFilters.store.trim(), appliedFilters.from, appliedFilters.to].filter(Boolean).length;
  const hasDraftFilters = draftFilterCount > 0;
  const hasAppliedFilters = appliedFilterCount > 0;
  const hasAppliedCriteria = Boolean(appliedSearch.trim() || hasAppliedFilters);
  const dateRangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  const appliedDateRangeInvalid = dateRangeInvalid && !filtersPending;
  const pageData = state.kind === 'loaded' && !appliedDateRangeInvalid ? state.page : null;
  const totalPages = pageData ? Math.max(1, Math.ceil(pageData.total / pageSize)) : 1;

  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !filtersPopoverRef.current?.contains(event.target)) {
        setFiltersOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [filtersOpen]);

  function updateFilter(key: keyof PurchaseFilterOptions, value: string) {
    onFiltersChange({ ...filters, [key]: value });
  }

  function applyFilters() {
    if (dateRangeInvalid) {
      setFiltersOpen(true);
      return;
    }
    onApplyFilters();
    setFiltersOpen(false);
  }

  function clearFilters() {
    onClearFilters();
    setFiltersOpen(false);
  }

  return (
    <section aria-labelledby="purchase-history-title" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="purchase-history-title" className="text-xl font-semibold tracking-tight">Purchase history</h2>
        <div className="flex items-center gap-2">
          {searchPending && (
            <Badge variant="secondary" className="gap-1.5">
              <LoaderCircle aria-hidden="true" className="size-3 animate-spin" /> Searching
            </Badge>
          )}
          {filtersPending && (
            <Badge variant="outline">Filters not applied</Badge>
          )}
          {pageData && (
            <p className="text-sm text-muted-foreground">{formatReceiptCount(pageData.total, pageNumber, pageSize, hasAppliedCriteria)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Label htmlFor="purchase-item-search" className="sr-only">Search item names</Label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="purchase-item-search"
            className="h-10 pl-9"
            type="search"
            value={itemSearch}
            onChange={(event) => onItemSearchChange(event.target.value)}
            placeholder="Search item names"
            maxLength={120}
            aria-label="Search item names"
          />
        </div>
        <div ref={filtersPopoverRef} className="relative shrink-0">
          <Button
            type="button"
            variant="outline"
            className="h-10 px-3"
            aria-expanded={filtersOpen}
            aria-controls="purchase-filter-panel"
            aria-label={appliedFilterCount > 0 ? `Filters, ${appliedFilterCount} active` : 'Filters'}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span className="hidden sm:inline">Filters</span>
            {appliedFilterCount > 0 && <Badge variant="secondary" className="ml-1">{appliedFilterCount}</Badge>}
          </Button>

          {filtersOpen && (
            <Card id="purchase-filter-panel" role="region" aria-label="Purchase filters" className="absolute right-0 top-full z-30 mt-2 w-[min(92vw,28rem)] overflow-visible p-4 shadow-lg">
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Filter purchases</h3>
                  <CardDescription>Choose a store or date range.</CardDescription>
                </div>
                <Label className="grid min-w-0 gap-2 text-sm font-medium">
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
                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
                {dateRangeInvalid && (
                  <p className="text-xs text-destructive" role="alert">The start date must be on or before the end date.</p>
                )}
                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  {hasDraftFilters || hasAppliedFilters ? (
                    <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                      <RotateCcw aria-hidden="true" /> Clear
                    </Button>
                  ) : <span />}
                  <Button type="button" size="sm" onClick={applyFilters} disabled={dateRangeInvalid}>
                    Apply filters
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {appliedDateRangeInvalid && (
        <Alert variant="destructive">
          <CalendarDays aria-hidden="true" />
          <AlertTitle>Check the date range</AlertTitle>
          <AlertDescription>The start date must be on or before the end date.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3" aria-live="polite" aria-busy={filtersPending || searchPending || state.kind === 'loading'}>
        {state.kind === 'loading' && !appliedDateRangeInvalid && (
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

        {state.kind === 'error' && !appliedDateRangeInvalid && (
          <Alert variant="destructive">
            <ReceiptText aria-hidden="true" />
            <AlertTitle>History could not load</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{state.message}</p>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button>
            </AlertDescription>
          </Alert>
        )}

        {state.kind === 'invalid' && !appliedDateRangeInvalid && (
          <Alert variant="destructive">
            <CalendarDays aria-hidden="true" />
            <AlertTitle>Check the date range</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {pageData && pageData.items.length === 0 && !hasAppliedCriteria && (
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

        {pageData && pageData.items.length === 0 && hasAppliedCriteria && (
          <Card>
            <CardContent className="flex flex-col items-center px-5 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">No matching purchases</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Try a different item, store, or date range.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {appliedSearch && (
                  <Button type="button" variant="outline" size="sm" onClick={onClearSearch}>
                    <RotateCcw aria-hidden="true" /> Clear search
                  </Button>
                )}
                {hasAppliedFilters && (
                  <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                    <RotateCcw aria-hidden="true" /> Clear filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {pageData?.items.map((purchase) => (
          <PurchaseCard key={purchase.id} purchase={purchase} searchQuery={appliedSearch} />
        ))}
      </div>

      {pageData && pageData.total > 0 && totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Purchase history pages">
          <Button variant="outline" size="sm" onClick={() => onPageChange(pageNumber - 1)} disabled={pageNumber <= 1 || state.kind === 'loading' || filtersPending || searchPending}>
            <ArrowLeft aria-hidden="true" /> Previous
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">Page {pageNumber} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => onPageChange(pageNumber + 1)} disabled={pageNumber >= totalPages || state.kind === 'loading' || filtersPending || searchPending}>
            Next <ArrowRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </section>
  );
}

export type { PurchaseHistoryState };
