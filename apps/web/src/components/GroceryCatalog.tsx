import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, ChevronRight, Search, Tags } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchGroceryItemPriceHistory,
  fetchGroceryItems,
  type GroceryItemPage,
  type PriceHistoryPage,
} from '@/lib/api';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: GroceryItemPage }
  | { kind: 'error'; message: string };

type PriceHistoryState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; page: PriceHistoryPage }
  | { kind: 'error'; message: string };

const catalogPageSize = 10;
const priceHistoryPageSize = 10;

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

const unitPriceFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function formatCentavos(amount: number): string {
  return phpFormatter.format(amount / 100);
}

function formatUnitPrice(centavos: number, unit: string): string {
  return `${unitPriceFormatter.format(centavos / 100)} / ${unit}`;
}

function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 }).format(quantity);
}

function formatPurchaseDate(date: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function CatalogPagination({
  page,
  total,
  pageSize,
  label,
  onPageChange,
  disabled,
}: {
  page: number;
  total: number;
  pageSize: number;
  label: string;
  onPageChange: (page: number) => void;
  disabled: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label={label}>
      <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1}>
        <ArrowLeft aria-hidden="true" /> Previous
      </Button>
      <span className="text-sm tabular-nums text-muted-foreground">Page {page} of {totalPages}</span>
      <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={disabled || page >= totalPages}>
        Next <ArrowRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Loading items">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-lg border p-3.5">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
      <span className="sr-only">Loading items…</span>
    </div>
  );
}

export default function GroceryCatalog({ refreshKey }: { refreshKey: number }) {
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogPageNumber, setCatalogPageNumber] = useState(1);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [catalogState, setCatalogState] = useState<CatalogState>({ kind: 'loading' });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [priceHistoryPageNumber, setPriceHistoryPageNumber] = useState(1);
  const [priceHistoryRefresh, setPriceHistoryRefresh] = useState(0);
  const [priceHistoryState, setPriceHistoryState] = useState<PriceHistoryState>({ kind: 'idle' });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchText.trim());
      setCatalogPageNumber(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    setPriceHistoryPageNumber(1);
  }, [selectedItemId]);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogState({ kind: 'loading' });

    void fetchGroceryItems(catalogPageNumber, catalogPageSize, searchQuery, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setCatalogState({ kind: 'loaded', page });
        setSelectedItemId((current) => (
          page.items.some((item) => item.id === current)
            ? current
            : page.items[0]?.id ?? null
        ));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load the grocery catalog.',
        });
      });

    return () => controller.abort();
  }, [catalogPageNumber, catalogRefresh, refreshKey, searchQuery]);

  useEffect(() => {
    if (!selectedItemId) {
      setPriceHistoryState({ kind: 'idle' });
      return;
    }

    const controller = new AbortController();
    setPriceHistoryState({ kind: 'loading' });

    void fetchGroceryItemPriceHistory(
      selectedItemId,
      priceHistoryPageNumber,
      priceHistoryPageSize,
      controller.signal
    )
      .then((page) => {
        if (!controller.signal.aborted) setPriceHistoryState({ kind: 'loaded', page });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPriceHistoryState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load price history.',
        });
      });

    return () => controller.abort();
  }, [selectedItemId, priceHistoryPageNumber, priceHistoryRefresh, refreshKey]);

  const catalogPage = catalogState.kind === 'loaded' ? catalogState.page : null;
  const priceHistoryPage = priceHistoryState.kind === 'loaded' ? priceHistoryState.page : null;
  const selectedItem = catalogPage?.items.find((item) => item.id === selectedItemId) ?? null;

  function selectItem(id: string) {
    setSelectedItemId(id);
    setPriceHistoryPageNumber(1);
  }

  return (
    <section id="grocery-catalog" aria-labelledby="grocery-catalog-title" className="scroll-mt-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Badge variant="secondary" className="w-fit">Item insights</Badge>
          <h2 id="grocery-catalog-title" className="text-2xl font-semibold tracking-tight">Catalog &amp; price history</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Browse grocery items from your receipts and compare recorded prices within the same unit.
          </p>
        </div>
        {catalogPage && <p className="text-sm text-muted-foreground">{catalogPage.total} {catalogPage.total === 1 ? 'item' : 'items'}</p>}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-4">
            <CardTitle className="text-base">Grocery items</CardTitle>
            <CardDescription>Choose an item to see its recorded prices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="grocery-item-search"
                className="pl-9"
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search by item name"
                maxLength={120}
                aria-label="Search items"
              />
            </div>

            <div className="space-y-2" aria-live="polite">
              {catalogState.kind === 'loading' && <LoadingCards count={3} />}
              {catalogState.kind === 'error' && (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>Catalog could not load</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>{catalogState.message}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setCatalogRefresh((current) => current + 1)}>Try again</Button>
                  </AlertDescription>
                </Alert>
              )}
              {catalogPage && catalogPage.items.length === 0 && (
                <Card className="border-dashed bg-muted/20 shadow-none">
                  <CardContent className="px-4 py-8 text-center">
                    <p className="text-sm font-medium">{searchQuery ? 'No matching grocery items' : 'No grocery items yet'}</p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {searchQuery ? 'Try a different name.' : 'Save a purchase to build your catalog.'}
                    </p>
                  </CardContent>
                </Card>
              )}
              {catalogPage?.items.map((item) => {
                const isSelected = item.id === selectedItemId;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="outline"
                    aria-pressed={isSelected}
                    onClick={() => selectItem(item.id)}
                    className={`h-auto w-full justify-between whitespace-normal px-3.5 py-3 text-left ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">View price history</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </Button>
                );
              })}
            </div>

            {catalogPage && (
              <CatalogPagination
                page={catalogPageNumber}
                total={catalogPage.total}
                pageSize={catalogPageSize}
                label="Grocery item pages"
                onPageChange={setCatalogPageNumber}
                disabled={catalogState.kind === 'loading'}
              />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 p-4 sm:p-5">
            <div className="space-y-1.5">
              <CardDescription>Recorded observations</CardDescription>
              <CardTitle className="text-lg">{selectedItem?.name ?? 'Price history'}</CardTitle>
            </div>
            {priceHistoryPage && priceHistoryPage.total > 0 && (
              <Badge variant="secondary">{priceHistoryPage.total} {priceHistoryPage.total === 1 ? 'record' : 'records'}</Badge>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            <p className="text-sm text-muted-foreground">Prices are listed by their receipt unit. Different units stay separate.</p>
            <Separator className="my-4" />

            <div className="space-y-2.5" aria-live="polite">
              {selectedItemId && priceHistoryState.kind === 'loading' && <LoadingCards count={2} />}
              {selectedItemId && priceHistoryState.kind === 'error' && (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>Price history could not load</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>{priceHistoryState.message}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setPriceHistoryRefresh((current) => current + 1)}>Try again</Button>
                  </AlertDescription>
                </Alert>
              )}
              {!selectedItemId && catalogState.kind === 'loaded' && (
                <Card className="border-dashed bg-muted/20 shadow-none">
                  <CardContent className="flex flex-col items-center px-4 py-10 text-center">
                    <Tags aria-hidden="true" className="size-5 text-primary" />
                    <p className="mt-3 text-sm font-medium">Select an item to view its prices</p>
                    <p className="mt-1 text-sm text-muted-foreground">Price records come from saved receipt lines.</p>
                  </CardContent>
                </Card>
              )}
              {priceHistoryPage?.items.map((observation) => (
                <Card key={observation.purchaseItemId} className="shadow-none">
                  <CardContent className="p-3.5 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          <time dateTime={observation.purchasedOn}>{formatPurchaseDate(observation.purchasedOn)}</time>
                        </p>
                        <p className="mt-1 truncate text-sm font-medium">{observation.storeName || 'Grocery trip'}</p>
                        {observation.itemName !== priceHistoryPage.groceryItem.name && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">Receipt label: {observation.itemName}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Line paid</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums">{formatCentavos(observation.amountPaidCentavos)}</p>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{formatQuantity(observation.quantity)} {observation.unit}</span>
                      <Badge variant="secondary" className="tabular-nums">
                        {formatUnitPrice(observation.unitPriceCentavos, observation.unit)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {priceHistoryPage && priceHistoryPage.total === 0 && (
                <Card className="border-dashed bg-muted/20 shadow-none">
                  <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No price observations found.
                  </CardContent>
                </Card>
              )}
            </div>

            {priceHistoryPage && (
              <CatalogPagination
                page={priceHistoryPageNumber}
                total={priceHistoryPage.total}
                pageSize={priceHistoryPageSize}
                label="Price history pages"
                onPageChange={setPriceHistoryPageNumber}
                disabled={priceHistoryState.kind === 'loading'}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
