import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, PackageCheck, PackageX, Pencil, Search, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { philippineDateString } from '@/lib/dates';
import {
  fetchPantryStockLots,
  fetchPantryStockWaste,
  recordPantryStockWaste,
  updatePantryStockLotExpiry,
  type PantryStockLot,
  type PantryStockWaste,
} from '@/lib/api';

type LotPageState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: Awaited<ReturnType<typeof fetchPantryStockLots>> }
  | { kind: 'error'; message: string };

type WastePageState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: Awaited<ReturnType<typeof fetchPantryStockWaste>> }
  | { kind: 'error'; message: string };

const pageSize = 12;
const quantityPattern = /^\d+(?:\.\d{1,3})?$/;

function parseQuantity(value: string): number | null {
  const trimmed = value.trim();
  if (!quantityPattern.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 999_999_999.999 ? parsed : null;
}

function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value));
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 }).format(value);
}

function formatReceivedAt(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));
}

function ExpiryBadge({ expiresOn, today }: { expiresOn: string | null; today: string }) {
  if (!expiresOn) return <Badge variant="secondary">No expiry date</Badge>;

  const daysRemaining = (Date.parse(`${expiresOn}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86_400_000;
  if (daysRemaining < 0) return <Badge variant="destructive">Expired {formatDateOnly(expiresOn)}</Badge>;
  if (daysRemaining === 0) return <Badge variant="destructive">Expires today</Badge>;
  if (daysRemaining <= 7) {
    return (
      <Badge variant="outline" className="border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300">
        Expires in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
      </Badge>
    );
  }
  return <Badge variant="outline">Expires {formatDateOnly(expiresOn)}</Badge>;
}

function sourceLabel(sourceType: PantryStockLot['sourceType']): string {
  if (sourceType === 'purchase') return 'Purchase';
  if (sourceType === 'opening_balance') return 'Existing stock';
  return 'Stock adjustment';
}

function HighlightedName({ name, query }: { name: string; query: string }) {
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

function EditLotExpiryDialog({
  lot,
  onOpenChange,
  onSaved,
}: {
  lot: PantryStockLot;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [expiresOn, setExpiresOn] = useState(lot.expiresOn ?? '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      await updatePantryStockLotExpiry(lot.id, expiresOn || null);
      onSaved();
      onOpenChange(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update this expiry date.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !isSaving && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lot.expiresOn ? 'Update expiry date' : 'Add expiry date'}</DialogTitle>
          <DialogDescription>
            {lot.itemName} · {formatQuantity(lot.quantityRemaining)} {lot.unit} remaining in this batch.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Label htmlFor="pantry-lot-expires-on" className="grid gap-2 text-sm font-medium">
            Expiry date <span className="font-normal text-muted-foreground">· optional</span>
            <Input
              id="pantry-lot-expires-on"
              type="date"
              className="h-10 w-full"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
              disabled={isSaving}
            />
          </Label>
          <p className="text-xs leading-5 text-muted-foreground">Expiry only flags this batch. It will stay in stock until you adjust its quantity or record waste.</p>
          {error && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Could not update expiry</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save date'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordWasteDialog({
  lot,
  onOpenChange,
  onSaved,
}: {
  lot: PantryStockLot;
  onOpenChange: (open: boolean) => void;
  onSaved: (waste: PantryStockWaste) => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const parsedQuantity = parseQuantity(quantity);
    if (parsedQuantity === null) {
      setError('Enter a positive amount with up to three decimal places.');
      return;
    }
    if (parsedQuantity > lot.quantityRemaining) {
      setError(`This batch has only ${formatQuantity(lot.quantityRemaining)} ${lot.unit} remaining.`);
      return;
    }

    setIsSaving(true);
    try {
      const waste = await recordPantryStockWaste(lot.id, parsedQuantity);
      onSaved(waste);
      onOpenChange(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not record this discarded amount.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !isSaving && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record discarded stock</DialogTitle>
          <DialogDescription>
            {lot.itemName} · {formatQuantity(lot.quantityRemaining)} {lot.unit} remaining in this batch.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Label htmlFor="pantry-lot-waste-quantity" className="grid gap-2 text-sm font-medium">
            Discarded quantity
            <div className="flex min-w-0 items-center gap-2">
              <Input
                id="pantry-lot-waste-quantity"
                className="h-10 min-w-0"
                type="number"
                min="0.001"
                max={lot.quantityRemaining}
                step="0.001"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="e.g. 0.5"
                required
                disabled={isSaving}
              />
              <span className="w-20 shrink-0 truncate text-sm text-muted-foreground">{lot.unit}</span>
            </div>
          </Label>
          <p className="text-xs leading-5 text-muted-foreground">This reduces the selected batch and pantry stock. Your grocery receipt stays unchanged.</p>
          {error && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Could not record waste</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={isSaving}>{isSaving ? 'Recording…' : 'Record waste'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PantryExpiryLots({ onUpdated }: { onUpdated?: () => void }) {
  const [state, setState] = useState<LotPageState>({ kind: 'loading' });
  const [wasteState, setWasteState] = useState<WastePageState>({ kind: 'loading' });
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [wastePageNumber, setWastePageNumber] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingLot, setEditingLot] = useState<PantryStockLot | null>(null);
  const [wasteLot, setWasteLot] = useState<PantryStockLot | null>(null);
  const [activeView, setActiveView] = useState('batches');
  const [wasteNotice, setWasteNotice] = useState('');
  const today = philippineDateString();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchText.trim());
      setPageNumber(1);
      setWastePageNumber(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    void fetchPantryStockLots(pageNumber, pageSize, searchQuery, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setState({ kind: 'loaded', page });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load pantry expiry dates.' });
      });
    return () => controller.abort();
  }, [pageNumber, refreshKey, searchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setWasteState({ kind: 'loading' });
    void fetchPantryStockWaste(wastePageNumber, pageSize, searchQuery, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setWasteState({ kind: 'loaded', page });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setWasteState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load waste history.' });
      });
    return () => controller.abort();
  }, [wastePageNumber, refreshKey, searchQuery]);

  const page = state.kind === 'loaded' ? state.page : null;
  const wastePage = wasteState.kind === 'loaded' ? wasteState.page : null;
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / pageSize));
  const totalWastePages = Math.max(1, Math.ceil((wastePage?.total ?? 0) / pageSize));

  return (
    <div className="space-y-3">
      <Tabs value={activeView} onValueChange={(value) => { setActiveView(value); setWasteNotice(''); }} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="batches">Current batches</TabsTrigger>
            <TabsTrigger value="history">Waste history</TabsTrigger>
          </TabsList>
          <div className="relative w-full min-w-0 sm:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 w-full min-w-0 pl-9"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search pantry items"
              aria-label="Search pantry batches and waste history"
            />
          </div>
        </div>

      {wasteNotice && (
        <Alert>
          <PackageX aria-hidden="true" />
          <AlertTitle>Waste recorded</AlertTitle>
          <AlertDescription>{wasteNotice}</AlertDescription>
        </Alert>
      )}

      <TabsContent value="batches" className="mt-0">
        <Card className="shadow-none">
          <CardHeader className="flex flex-col gap-1 space-y-0 p-4 sm:p-5">
            <CardTitle className="text-base">Expiry dates</CardTitle>
            <CardDescription>Review each current batch, update its expiry date, or record discarded stock.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {page ? `Showing ${page.items.length === 0 ? 0 : (pageNumber - 1) * pageSize + 1}–${Math.min(pageNumber * pageSize, page.total)} of ${page.total} current batches` : 'Loading current batches…'}
            </p>

            {state.kind === 'loading' && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading expiry dates">
                {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-36" />)}
              </div>
            )}

            {state.kind === 'error' && (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Expiry dates could not load</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  <span>{state.message}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setRefreshKey((current) => current + 1)}>Try again</Button>
                </AlertDescription>
              </Alert>
            )}

            {page && page.items.length === 0 && (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
                <span className="mb-2 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarDays aria-hidden="true" className="size-4" /></span>
                <p className="text-sm font-medium">{searchQuery ? 'No batches match your search' : 'No current pantry batches'}</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  {searchQuery ? 'Try another grocery item name.' : 'Add a purchase to pantry stock to see its batch here.'}
                </p>
              </div>
            )}

            {page && page.items.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {page.items.map((lot) => (
                  <Card key={lot.id} className="min-w-0 shadow-none">
                    <CardContent className="p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <PackageCheck aria-hidden="true" className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold"><HighlightedName name={lot.itemName} query={searchQuery} /></h3>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{lot.unit} · {sourceLabel(lot.sourceType)}</p>
                          </div>
                        </div>
                        <ExpiryBadge expiresOn={lot.expiresOn} today={today} />
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Remaining in batch</p>
                          <p className="mt-1 text-xl font-semibold tabular-nums">{formatQuantity(lot.quantityRemaining)} <span className="text-sm font-medium text-muted-foreground">{lot.unit}</span></p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {lot.purchaseDate ? (
                            <p>{lot.storeName || 'Grocery trip'} · {formatDateOnly(lot.purchaseDate)}</p>
                          ) : (
                            <p>Received {formatReceivedAt(lot.receivedAt)}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditingLot(lot)}>
                          {lot.expiresOn ? <Pencil aria-hidden="true" /> : <CalendarDays aria-hidden="true" />}
                          {lot.expiresOn ? 'Edit expiry' : 'Add expiry'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setWasteNotice(''); setWasteLot(lot); }}>
                          <Trash2 aria-hidden="true" /> Record waste
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {page && page.total > pageSize && (
              <nav className="flex items-center justify-between gap-3 border-t pt-3" aria-label="Pantry expiry pages">
                <Button type="button" variant="outline" size="sm" onClick={() => setPageNumber((current) => current - 1)} disabled={pageNumber <= 1 || state.kind === 'loading'}>
                  <ArrowLeft aria-hidden="true" /> Previous
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">Showing {(pageNumber - 1) * pageSize + 1}–{Math.min(pageNumber * pageSize, page.total)} of {page.total}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setPageNumber((current) => current + 1)} disabled={pageNumber >= totalPages || state.kind === 'loading'}>
                  Next <ArrowRight aria-hidden="true" />
                </Button>
              </nav>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history" className="mt-0">
        <Card className="shadow-none">
          <CardHeader className="flex flex-col gap-1 space-y-0 p-4 sm:p-5">
            <CardTitle className="text-base">Waste history</CardTitle>
            <CardDescription>Discarded quantities are recorded per batch. Receipt history stays unchanged.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {wastePage ? `Showing ${wastePage.items.length === 0 ? 0 : (wastePageNumber - 1) * pageSize + 1}–${Math.min(wastePageNumber * pageSize, wastePage.total)} of ${wastePage.total} records` : 'Loading waste history…'}
            </p>

            {wasteState.kind === 'loading' && (
              <div className="space-y-2" role="status" aria-label="Loading waste history">
                {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16" />)}
              </div>
            )}

            {wasteState.kind === 'error' && (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Waste history could not load</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  <span>{wasteState.message}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setRefreshKey((current) => current + 1)}>Try again</Button>
                </AlertDescription>
              </Alert>
            )}

            {wastePage && wastePage.items.length === 0 && (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
                <span className="mb-2 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"><PackageX aria-hidden="true" className="size-4" /></span>
                <p className="text-sm font-medium">{searchQuery ? 'No waste records match your search' : 'No waste recorded yet'}</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{searchQuery ? 'Try another grocery item name.' : 'Record a discarded quantity from a current batch to keep its history here.'}</p>
              </div>
            )}

            {wastePage && wastePage.items.length > 0 && (
              <div className="space-y-1.5">
                {wastePage.items.map((waste) => (
                  <div key={waste.id} className="flex min-w-0 flex-col gap-2 rounded-md border bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive"><PackageX aria-hidden="true" className="size-3.5" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium"><HighlightedName name={waste.itemName} query={searchQuery} /></p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {waste.purchaseDate
                            ? `${waste.storeName || 'Grocery trip'} · purchased ${formatDateOnly(waste.purchaseDate)}`
                            : `Received ${formatReceivedAt(waste.receivedAt)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-9 text-xs sm:justify-end sm:pl-0">
                      <span className="font-medium">−{formatQuantity(waste.quantityWasted)} {waste.unit} discarded</span>
                      <span className="text-muted-foreground">{formatQuantity(waste.quantityRemainingAfter)} {waste.unit} remained</span>
                      <time className="text-muted-foreground" dateTime={waste.discardedAt}>{formatDateTime(waste.discardedAt)}</time>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {wastePage && wastePage.total > pageSize && (
              <nav className="flex items-center justify-between gap-3 border-t pt-3" aria-label="Pantry waste history pages">
                <Button type="button" variant="outline" size="sm" onClick={() => setWastePageNumber((current) => current - 1)} disabled={wastePageNumber <= 1 || wasteState.kind === 'loading'}>
                  <ArrowLeft aria-hidden="true" /> Previous
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">Showing {(wastePageNumber - 1) * pageSize + 1}–{Math.min(wastePageNumber * pageSize, wastePage.total)} of {wastePage.total}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setWastePageNumber((current) => current + 1)} disabled={wastePageNumber >= totalWastePages || wasteState.kind === 'loading'}>
                  Next <ArrowRight aria-hidden="true" />
                </Button>
              </nav>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>

      {editingLot && (
        <EditLotExpiryDialog
          lot={editingLot}
          onOpenChange={(open) => { if (!open) setEditingLot(null); }}
          onSaved={() => {
            setEditingLot(null);
            setRefreshKey((current) => current + 1);
            onUpdated?.();
          }}
        />
      )}

      {wasteLot && (
        <RecordWasteDialog
          lot={wasteLot}
          onOpenChange={(open) => { if (!open) setWasteLot(null); }}
          onSaved={(waste) => {
            setWasteLot(null);
            setWasteNotice(`Recorded ${formatQuantity(waste.quantityWasted)} ${waste.unit} discarded from ${waste.itemName}. ${waste.quantityRemainingAfter > 0 ? `${formatQuantity(waste.quantityRemainingAfter)} ${waste.unit} remains in this batch.` : 'No stock remains in this batch.'}`);
            setWastePageNumber(1);
            setActiveView('history');
            setRefreshKey((current) => current + 1);
            onUpdated?.();
          }}
        />
      )}
    </div>
  );
}
