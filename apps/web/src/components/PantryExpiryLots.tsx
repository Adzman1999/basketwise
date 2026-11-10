import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, PackageCheck, Pencil, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { philippineDateString } from '@/lib/dates';
import { fetchPantryStockLots, updatePantryStockLotExpiry, type PantryStockLot } from '@/lib/api';

type LotPageState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: Awaited<ReturnType<typeof fetchPantryStockLots>> }
  | { kind: 'error'; message: string };

const pageSize = 12;

function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00.000Z`));
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

export default function PantryExpiryLots({ onUpdated }: { onUpdated?: () => void }) {
  const [state, setState] = useState<LotPageState>({ kind: 'loading' });
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingLot, setEditingLot] = useState<PantryStockLot | null>(null);
  const today = philippineDateString();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchText.trim());
      setPageNumber(1);
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

  const page = state.kind === 'loaded' ? state.page : null;
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / pageSize));

  return (
    <div className="space-y-3">
      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 space-y-0 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="space-y-1">
            <CardTitle className="text-base">Expiry dates</CardTitle>
            <p className="text-sm text-muted-foreground">Review each current batch and set its own expiry date.</p>
          </div>
          <div className="relative w-full min-w-0 sm:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 w-full min-w-0 pl-9"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search pantry items"
              aria-label="Search pantry expiry lots"
            />
          </div>
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
                    <div className="mt-3 flex justify-end border-t pt-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditingLot(lot)}>
                        {lot.expiresOn ? <Pencil aria-hidden="true" /> : <CalendarDays aria-hidden="true" />}
                        {lot.expiresOn ? 'Edit expiry' : 'Add expiry'}
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
    </div>
  );
}
