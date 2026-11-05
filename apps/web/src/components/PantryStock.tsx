import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  PackageCheck,
  PackageX,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  createPantryStock,
  deletePantryStock,
  fetchGroceryItems,
  fetchPantryStock,
  fetchUnits,
  updatePantryStock,
  type GroceryItem,
  type MeasurementUnit,
  type PantryStockItem,
  type PantryStockStatus,
} from '@/lib/api';

type PantryStockState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: Awaited<ReturnType<typeof fetchPantryStock>> }
  | { kind: 'error'; message: string };

const pageSize = 12;
const quantityPattern = /^\d+(?:\.\d{1,3})?$/;

function parseQuantity(value: string): number | null {
  const trimmed = value.trim();
  if (!quantityPattern.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed <= 999_999_999.999 ? parsed : null;
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 }).format(value);
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));
}

const statusLabels: Record<PantryStockStatus, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
};

function StatusBadge({ status }: { status: PantryStockStatus }) {
  const className = status === 'in_stock'
    ? 'border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
    : status === 'low_stock'
      ? 'border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300'
      : '';
  return <Badge variant={status === 'out_of_stock' ? 'destructive' : 'outline'} className={className}>{statusLabels[status]}</Badge>;
}

function HighlightedItemName({ name, query }: { name: string; query: string }) {
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

function PantryStockFormDialog({
  open,
  item,
  units,
  unitsError,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  item: PantryStockItem | null;
  units: MeasurementUnit[];
  unitsError: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [selectedItem, setSelectedItem] = useState<GroceryItem | null>(null);
  const [selectingItem, setSelectingItem] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [threshold, setThreshold] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [catalogItems, setCatalogItems] = useState<GroceryItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedItem(item ? { id: item.groceryItemId, name: item.itemName } : null);
    setSelectingItem(!item);
    setUnitId(item?.unitId ?? '');
    setQuantity(item ? String(item.quantity) : '');
    setThreshold(item?.lowStockThreshold === null || item?.lowStockThreshold === undefined ? '' : String(item.lowStockThreshold));
    setItemSearch('');
    setFormError('');
  }, [open, item]);

  useEffect(() => {
    if (!open || item || !selectingItem) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsCatalogLoading(true);
      setCatalogError('');
      void fetchGroceryItems(1, 20, itemSearch, controller.signal)
        .then((page) => {
          if (!controller.signal.aborted) setCatalogItems(page.items);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setCatalogError(error instanceof Error ? error.message : 'Could not load grocery items.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsCatalogLoading(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [item, itemSearch, open, selectingItem]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const parsedQuantity = parseQuantity(quantity);
    const parsedThreshold = threshold.trim() === '' ? null : parseQuantity(threshold);
    if (parsedQuantity === null || (threshold.trim() !== '' && parsedThreshold === null)) {
      setFormError('Enter amounts with up to three decimal places.');
      return;
    }
    if (!item && !selectedItem) {
      setFormError('Choose a saved grocery item. Record a grocery receipt first if your catalog is empty.');
      return;
    }
    if (!item && !unitId) {
      setFormError('Choose a measurement unit.');
      return;
    }

    setIsSaving(true);
    try {
      if (item) {
        await updatePantryStock(item.id, { quantity: parsedQuantity, lowStockThreshold: parsedThreshold });
      } else if (selectedItem) {
        await createPantryStock({
          groceryItemId: selectedItem.id,
          unitId,
          quantity: parsedQuantity,
          lowStockThreshold: parsedThreshold,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this pantry stock.');
    } finally {
      setIsSaving(false);
    }
  }

  const title = item ? 'Adjust pantry stock' : 'Add pantry stock';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {item ? 'Set the amount currently on hand. Receipt history stays unchanged.' : 'Track a saved grocery item and choose when it should be flagged as low.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            {item ? (
              <div className="grid gap-2">
                <Label>Grocery item</Label>
                <div className="flex h-10 min-w-0 items-center rounded-md border bg-muted/30 px-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{item.itemName}</span>
                  <span className="ml-auto shrink-0 pl-3 text-muted-foreground">{item.unit}</span>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="pantry-item-search">Grocery item</Label>
                {selectedItem && !selectingItem ? (
                  <div className="flex min-h-10 min-w-0 items-center gap-2 rounded-md border bg-muted/30 px-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{selectedItem.name}</span>
                    <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setSelectingItem(true)}>Change</Button>
                  </div>
                ) : (
                  <Command shouldFilter={false} className="rounded-md border bg-background">
                    <CommandInput
                      id="pantry-item-search"
                      placeholder="Search saved grocery items"
                      value={itemSearch}
                      onValueChange={setItemSearch}
                      disabled={isSaving}
                    />
                    <CommandList className="max-h-40">
                      {isCatalogLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Searching items…</div>}
                      {catalogError && <div className="px-3 py-2 text-sm text-destructive">{catalogError}</div>}
                      {!isCatalogLoading && !catalogError && catalogItems.map((catalogItem) => (
                        <CommandItem
                          key={catalogItem.id}
                          value={catalogItem.id}
                          onSelect={() => {
                            setSelectedItem(catalogItem);
                            setSelectingItem(false);
                            setFormError('');
                          }}
                        >
                          <HighlightedItemName name={catalogItem.name} query={itemSearch} />
                        </CommandItem>
                      ))}
                      {!isCatalogLoading && !catalogError && catalogItems.length === 0 && (
                        <CommandEmpty>{itemSearch ? 'No matching saved items.' : 'Record a grocery receipt to build your item catalog.'}</CommandEmpty>
                      )}
                    </CommandList>
                  </Command>
                )}
              </div>
            )}

            {!item && (
              <div className="grid gap-2">
                <Label htmlFor="pantry-unit">Unit</Label>
                <Select value={unitId} onValueChange={setUnitId} disabled={isSaving || units.length === 0}>
                  <SelectTrigger id="pantry-unit" className="h-10 w-full">
                    <SelectValue placeholder="Choose a unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {unitsError && <p className="text-xs text-destructive">{unitsError}</p>}
              </div>
            )}

            <Label htmlFor="pantry-quantity" className="grid gap-2 text-sm font-medium">
              Current quantity
              <div className="flex min-w-0 items-center gap-2">
                <Input
                  id="pantry-quantity"
                  className="h-10 min-w-0"
                  type="number"
                  min="0"
                  max="999999999.999"
                  step="0.001"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="e.g. 2"
                  required
                  disabled={isSaving}
                />
                <span className="w-20 shrink-0 truncate text-sm text-muted-foreground">{item?.unit ?? units.find((unit) => unit.id === unitId)?.name ?? 'unit'}</span>
              </div>
            </Label>

            <Label htmlFor="pantry-threshold" className="grid gap-2 text-sm font-medium">
              Low-stock alert at <span className="font-normal text-muted-foreground">· optional</span>
              <div className="flex min-w-0 items-center gap-2">
                <Input
                  id="pantry-threshold"
                  className="h-10 min-w-0"
                  type="number"
                  min="0"
                  max="999999999.999"
                  step="0.001"
                  inputMode="decimal"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                  placeholder="Leave empty to skip alerts"
                  disabled={isSaving}
                />
                <span className="w-20 shrink-0 truncate text-sm text-muted-foreground">{item?.unit ?? units.find((unit) => unit.id === unitId)?.name ?? 'unit'}</span>
              </div>
            </Label>

            <p className="text-xs leading-5 text-muted-foreground">Items reach “Low stock” at or below this amount. A quantity of zero is marked “Out of stock.”</p>
            {formError && (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Could not save stock</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving || (!item && units.length === 0)}>
              {isSaving ? 'Saving…' : item ? 'Save stock' : 'Add to pantry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  tone: 'neutral' | 'warning' | 'danger';
}) {
  const toneClass = tone === 'warning'
    ? 'bg-amber-600/10 text-amber-700 dark:text-amber-300'
    : tone === 'danger'
      ? 'bg-destructive/10 text-destructive'
      : 'bg-primary/10 text-primary';
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PantryStock() {
  const [stockState, setStockState] = useState<PantryStockState>({ kind: 'loading' });
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [unitsError, setUnitsError] = useState('');
  const [unitRefresh, setUnitRefresh] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<PantryStockStatus | ''>('');
  const [pageNumber, setPageNumber] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryStockItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PantryStockItem | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchText.trim());
      setPageNumber(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchUnits(controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          setUnits(page.items);
          setUnitsError('');
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setUnitsError(error instanceof Error ? error.message : 'Could not load measurement units.');
      });
    return () => controller.abort();
  }, [unitRefresh]);

  useEffect(() => {
    const controller = new AbortController();
    setStockState({ kind: 'loading' });
    void fetchPantryStock(pageNumber, pageSize, searchQuery, status, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setStockState({ kind: 'loaded', page });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStockState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load pantry stock.' });
      });
    return () => controller.abort();
  }, [pageNumber, refreshKey, searchQuery, status]);

  async function removeStock() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deletePantryStock(deleteTarget.id);
      setDeleteTarget(null);
      if (stockState.kind === 'loaded' && stockState.page.items.length === 1 && pageNumber > 1) {
        setPageNumber((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not remove this pantry record.');
    } finally {
      setIsDeleting(false);
    }
  }

  const page = stockState.kind === 'loaded' ? stockState.page : null;
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / pageSize));

  return (
    <section aria-labelledby="pantry-stock-title" className="space-y-5">
      <div className="space-y-1.5">
        <Badge variant="secondary" className="w-fit gap-1.5"><PackageCheck aria-hidden="true" className="size-4" /> Household stock</Badge>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="pantry-stock-title" className="text-2xl font-semibold tracking-tight">Pantry stock</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Keep current quantities visible and know when household staples are running low.</p>
          </div>
          <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }} disabled={units.length === 0}>
            <Plus aria-hidden="true" /> Add stock
          </Button>
        </div>
      </div>

      {unitsError && (
        <Alert variant="destructive">
          <AlertTitle>Measurement units could not load</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{unitsError}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setUnitRefresh((current) => current + 1)}>Try again</Button>
          </AlertDescription>
        </Alert>
      )}

      {stockState.kind === 'loaded' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard icon={Boxes} label="Tracked item and unit pairs" value={stockState.page.summary.total} tone="neutral" />
          <SummaryCard icon={TriangleAlert} label="At or below low-stock level" value={stockState.page.summary.lowStock} tone="warning" />
          <SummaryCard icon={PackageX} label="Out of stock" value={stockState.page.summary.outOfStock} tone="danger" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3" aria-label="Loading pantry summary">
          <Skeleton className="h-[76px]" /><Skeleton className="h-[76px]" /><Skeleton className="h-[76px]" />
        </div>
      )}

      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 space-y-0 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="space-y-1">
            <CardTitle className="text-base">Your pantry</CardTitle>
            <CardDescription>One current quantity per saved grocery item and unit.</CardDescription>
          </div>
          <div className="grid w-full gap-2 sm:max-w-xl sm:grid-cols-[minmax(0,1fr)_11rem]">
            <div className="relative min-w-0">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 w-full min-w-0 pl-9"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search pantry items"
                aria-label="Search pantry items"
              />
            </div>
            <Select value={status || 'all'} onValueChange={(value) => { setStatus(value === 'all' ? '' : value as PantryStockStatus); setPageNumber(1); }}>
              <SelectTrigger className="h-10 w-full" aria-label="Filter pantry stock by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stock</SelectItem>
                <SelectItem value="in_stock">In stock</SelectItem>
                <SelectItem value="low_stock">Low stock</SelectItem>
                <SelectItem value="out_of_stock">Out of stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {stockState.kind === 'loading' && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading pantry stock">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-40" />)}
            </div>
          )}

          {stockState.kind === 'error' && (
            <Alert variant="destructive">
              <AlertTitle>Pantry stock could not load</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{stockState.message}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setRefreshKey((current) => current + 1)}>Try again</Button>
              </AlertDescription>
            </Alert>
          )}

          {page && page.items.length === 0 && (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
              <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><PackageCheck className="size-5" aria-hidden="true" /></span>
              <p className="text-sm font-medium">{page.total > 0 ? 'No pantry items match' : 'Your pantry is not tracked yet'}</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                {page.total > 0
                  ? 'Try another item name or stock filter.'
                  : 'Record a grocery purchase first, then add its saved items here with their current quantities.'}
              </p>
              {page.total === 0 && <Button className="mt-4" onClick={() => { setEditingItem(null); setDialogOpen(true); }} disabled={units.length === 0}><Plus aria-hidden="true" /> Add stock</Button>}
            </div>
          )}

          {page && page.items.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {page.items.map((stock) => (
                <Card key={stock.id} className="min-w-0 shadow-none">
                  <CardContent className="p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><PackageCheck aria-hidden="true" className="size-4" /></span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold"><HighlightedItemName name={stock.itemName} query={searchQuery} /></h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">{stock.unit}</p>
                        </div>
                      </div>
                      <StatusBadge status={stock.status} />
                    </div>
                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Current quantity</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">{formatQuantity(stock.quantity)} <span className="text-sm font-medium text-muted-foreground">{stock.unit}</span></p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{stock.lowStockThreshold === null ? 'No alert level' : `Low at ${formatQuantity(stock.lowStockThreshold)} ${stock.unit}`}</p>
                        <p className="mt-1">Updated {formatUpdatedAt(stock.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2 border-t pt-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => { setEditingItem(stock); setDialogOpen(true); }}>
                        <Pencil aria-hidden="true" /> Adjust
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${stock.itemName} from pantry`} title="Remove stock record" onClick={() => { setDeleteError(''); setDeleteTarget(stock); }}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {page && page.total > pageSize && (
            <nav className="mt-5 flex items-center justify-between gap-3 border-t pt-4" aria-label="Pantry stock pages">
              <Button type="button" variant="outline" size="sm" onClick={() => setPageNumber((current) => current - 1)} disabled={pageNumber <= 1 || stockState.kind === 'loading'}>
                <ArrowLeft aria-hidden="true" /> Previous
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">Showing {(pageNumber - 1) * pageSize + 1}–{Math.min(pageNumber * pageSize, page.total)} of {page.total}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setPageNumber((current) => current + 1)} disabled={pageNumber >= totalPages || stockState.kind === 'loading'}>
                Next <ArrowRight aria-hidden="true" />
              </Button>
            </nav>
          )}
        </CardContent>
      </Card>

      <PantryStockFormDialog
        open={dialogOpen}
        item={editingItem}
        units={units}
        unitsError={unitsError}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((current) => current + 1)}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !isDeleting && !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove pantry record?</DialogTitle>
            <DialogDescription>
              This removes {deleteTarget?.itemName} ({deleteTarget?.unit}) from pantry tracking. Receipt history will stay saved.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <Alert variant="destructive"><AlertTitle>Could not remove stock</AlertTitle><AlertDescription>{deleteError}</AlertDescription></Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={() => void removeStock()} disabled={isDeleting}>
              <Trash2 aria-hidden="true" /> {isDeleting ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
