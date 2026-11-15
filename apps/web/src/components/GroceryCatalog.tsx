import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowLeftRight, ArrowRight, ChevronRight, Pencil, Search, Tags, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchGroceryItemPriceHistory,
  fetchGroceryItems,
  fetchGroceryItemUnitConversions,
  fetchUnits,
  saveGroceryItemUnitConversion,
  deleteGroceryItemUnitConversion,
  type GroceryItemUnitConversion,
  type GroceryItemPage,
  type MeasurementUnit,
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

function formatConversionQuantity(quantity: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 9 }).format(quantity);
}

function HighlightedCatalogName({ name, query }: { name: string; query: string }) {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
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

type ConversionState =
  | { kind: 'loading' }
  | { kind: 'loaded'; conversions: GroceryItemUnitConversion[]; units: MeasurementUnit[] }
  | { kind: 'error'; message: string };

function UnitConversionManager({
  itemId,
  itemName,
  purchaseUnits,
}: {
  itemId: string;
  itemName: string;
  purchaseUnits: Array<{ id: string; name: string }>;
}) {
  const [state, setState] = useState<ConversionState>({ kind: 'loading' });
  const [purchaseUnitId, setPurchaseUnitId] = useState('');
  const [recipeUnitId, setRecipeUnitId] = useState('');
  const [yieldQuantity, setYieldQuantity] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([fetchGroceryItemUnitConversions(itemId, controller.signal), fetchUnits(controller.signal)])
      .then(([conversionPage, unitPage]) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'loaded', conversions: conversionPage.items, units: unitPage.items });
        }
      })
      .catch((caughtError: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', message: caughtError instanceof Error ? caughtError.message : 'Could not load unit conversions.' });
      });
    return () => controller.abort();
  }, [itemId]);

  const savedConversions = state.kind === 'loaded' ? state.conversions : [];
  const purchaseUnitOptions = Array.from(
    new Map([
      ...purchaseUnits,
      ...savedConversions.map((conversion) => ({ id: conversion.purchaseUnitId, name: conversion.purchaseUnit })),
    ].map((unit) => [unit.id, unit] as const)).values(),
  );

  function beginEdit(conversion: GroceryItemUnitConversion) {
    setPurchaseUnitId(conversion.purchaseUnitId);
    setRecipeUnitId(conversion.recipeUnitId);
    setYieldQuantity(String(conversion.recipeUnitsPerPurchaseUnit));
    setEditingId(conversion.id);
    setError('');
  }

  function resetForm() {
    setPurchaseUnitId('');
    setRecipeUnitId('');
    setYieldQuantity('');
    setEditingId(null);
    setError('');
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const parsedYield = Number(yieldQuantity);
    if (!purchaseUnitId || !recipeUnitId || purchaseUnitId === recipeUnitId
      || !Number.isFinite(parsedYield) || parsedYield <= 0 || parsedYield > 999_999_999.999999999
      || Math.abs(parsedYield * 1_000_000_000 - Math.round(parsedYield * 1_000_000_000)) >= 0.0001) {
      setError('Choose two different units and enter a positive amount with up to 9 decimal places.');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await saveGroceryItemUnitConversion(itemId, {
        purchaseUnitId,
        recipeUnitId,
        recipeUnitsPerPurchaseUnit: parsedYield,
      });
      setState((current) => current.kind === 'loaded'
        ? {
          ...current,
          conversions: [...current.conversions.filter((conversion) => conversion.id !== saved.id), saved]
            .sort((left, right) => left.purchaseUnit.localeCompare(right.purchaseUnit) || left.recipeUnit.localeCompare(right.recipeUnit)),
        }
        : current);
      resetForm();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save this conversion.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(conversion: GroceryItemUnitConversion) {
    setError('');
    setDeletingId(conversion.id);
    try {
      await deleteGroceryItemUnitConversion(itemId, conversion.id);
      setState((current) => current.kind === 'loaded'
        ? { ...current, conversions: current.conversions.filter((saved) => saved.id !== conversion.id) }
        : current);
      if (editingId === conversion.id) resetForm();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete this conversion.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-5 border-t pt-5" aria-labelledby="unit-conversions-title">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><ArrowLeftRight aria-hidden="true" className="size-4" /></span>
        <div className="min-w-0">
          <h3 id="unit-conversions-title" className="text-sm font-semibold">Unit yields &amp; conversions</h3>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Set package yields for this item, such as 1 can = 400 g. Grams/kg and milliliters/liters convert automatically.</p>
        </div>
      </div>

      {state.kind === 'loading' && <Skeleton className="mt-4 h-20" />}
      {state.kind === 'error' && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Conversions could not load</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.kind === 'loaded' && (
        <>
          <form onSubmit={(event) => void handleSave(event)} className="mt-4 grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_auto] sm:items-end">
            <Label className="grid min-w-0 gap-1.5 text-xs font-medium">
              Receipt unit
              <Select value={purchaseUnitId || 'unselected'} onValueChange={(value) => setPurchaseUnitId(value === 'unselected' ? '' : value)} disabled={isSaving || editingId !== null}>
                <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Bought as" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unselected">Choose unit</SelectItem>
                  {purchaseUnitOptions.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Label>
            <Label htmlFor={`unit-yield-${itemId}`} className="grid min-w-0 gap-1.5 text-xs font-medium">
              Yields
              <Input id={`unit-yield-${itemId}`} type="number" min="0.000000001" max="999999999.999999999" step="0.000000001" inputMode="decimal" value={yieldQuantity} onChange={(event) => setYieldQuantity(event.target.value)} placeholder="e.g. 400" disabled={isSaving} required />
            </Label>
            <Label className="grid min-w-0 gap-1.5 text-xs font-medium">
              Recipe unit
              <Select value={recipeUnitId || 'unselected'} onValueChange={(value) => setRecipeUnitId(value === 'unselected' ? '' : value)} disabled={isSaving || editingId !== null}>
                <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Converts to" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unselected">Choose unit</SelectItem>
                  {state.units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Label>
            <div className="flex gap-2 sm:justify-self-end">
              <Button type="submit" size="sm" disabled={isSaving || purchaseUnitOptions.length === 0 || state.units.length === 0}>{isSaving ? 'Saving…' : editingId ? 'Update' : 'Save yield'}</Button>
              {editingId && <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={isSaving}>Cancel</Button>}
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground sm:col-span-4">
              Means 1 selected receipt unit contains the amount entered in the recipe unit. This rule only applies to {itemName}.
            </p>
          </form>

          {error && <Alert variant="destructive" className="mt-3"><AlertCircle aria-hidden="true" /><AlertTitle>Unit conversion update failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="mt-3 space-y-2">
            {state.conversions.map((conversion) => (
              <div key={conversion.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5">
                <p className="min-w-0 text-sm font-medium">1 {conversion.purchaseUnit} = {formatConversionQuantity(conversion.recipeUnitsPerPurchaseUnit)} {conversion.recipeUnit}</p>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={`Edit conversion from ${conversion.purchaseUnit} to ${conversion.recipeUnit}`} title="Edit conversion" onClick={() => beginEdit(conversion)} disabled={isSaving || deletingId !== null}><Pencil aria-hidden="true" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Delete conversion from ${conversion.purchaseUnit} to ${conversion.recipeUnit}`} title="Delete conversion" onClick={() => void handleDelete(conversion)} disabled={isSaving || deletingId !== null}>
                    {deletingId === conversion.id ? <span className="text-xs">…</span> : <Trash2 aria-hidden="true" />}
                  </Button>
                </div>
              </div>
            ))}
            {state.conversions.length === 0 && (
              <p className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">No item-specific yields saved. Compatible recipe costs will use exact units and standard metric conversions.</p>
            )}
          </div>
        </>
      )}
    </section>
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
  const normalizedSearchQuery = searchQuery.trim().replace(/\s+/g, ' ').toLowerCase();

  function selectItem(id: string) {
    setSelectedItemId(id);
    setPriceHistoryPageNumber(1);
  }

  return (
    <section id="grocery-catalog" aria-labelledby="grocery-catalog-title" className="scroll-mt-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Badge variant="secondary" className="w-fit gap-1.5"><Tags aria-hidden="true" className="size-4" /> Item insights</Badge>
          <h2 id="grocery-catalog-title" className="text-2xl font-semibold tracking-tight">Catalog &amp; price history</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Browse receipt prices and save item-specific yields for recipe costing.
          </p>
        </div>
        {catalogPage && <p className="text-sm text-muted-foreground">{catalogPage.total} {catalogPage.total === 1 ? 'item' : 'items'}</p>}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-4">
            <CardTitle className="text-base">Catalog</CardTitle>
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
                const isExactMatch = normalizedSearchQuery !== ''
                  && item.name.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedSearchQuery;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="outline"
                    aria-pressed={isSelected}
                    onClick={() => selectItem(item.id)}
                    className={`h-auto w-full justify-between whitespace-normal px-3.5 py-3 text-left ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="block min-w-0 flex-1 truncate text-sm font-medium">
                          <HighlightedCatalogName name={item.name} query={searchQuery} />
                        </span>
                        {normalizedSearchQuery && (
                          <Badge className="shrink-0" variant={isExactMatch ? 'default' : 'outline'}>
                            {isExactMatch ? 'Exact match' : 'Close match'}
                          </Badge>
                        )}
                      </span>
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
            <p className="text-sm text-muted-foreground">Prices are listed by their receipt unit. Recipe costs can use standard conversions and item-specific yields.</p>
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
            {selectedItem && priceHistoryPage && (
              <UnitConversionManager
                key={selectedItem.id}
                itemId={selectedItem.id}
                itemName={selectedItem.name}
                purchaseUnits={priceHistoryPage.units}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
