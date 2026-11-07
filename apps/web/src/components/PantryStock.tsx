import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  PackageCheck,
  PackageX,
  Pencil,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { philippineDateString } from '@/lib/dates';
import {
  deletePantryStock,
  fetchPantryStock,
  updatePantryStock,
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

function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00.000Z`));
}

function ExpiryDisplay({ expiresOn, today }: { expiresOn: string | null; today: string }) {
  if (!expiresOn) return <p>No expiry date</p>;
  const daysRemaining = (Date.parse(`${expiresOn}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86_400_000;
  if (daysRemaining < 0) {
    return <Badge variant="destructive">Expired {formatDateOnly(expiresOn)}</Badge>;
  }
  if (daysRemaining === 0) {
    return <Badge variant="destructive">Expires today</Badge>;
  }
  if (daysRemaining <= 7) {
    return <Badge variant="outline" className="border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300">Expires in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}</Badge>;
  }
  return <p>Expires {formatDateOnly(expiresOn)}</p>;
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
  item,
  onOpenChange,
  onSaved,
}: {
  item: PantryStockItem;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [threshold, setThreshold] = useState(item.lowStockThreshold === null ? '' : String(item.lowStockThreshold));
  const [autoRestock, setAutoRestock] = useState(item.autoRestock);
  const [expiresOn, setExpiresOn] = useState(item.expiresOn ?? '');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const parsedQuantity = parseQuantity(quantity);
    const parsedThreshold = threshold.trim() === '' ? null : parseQuantity(threshold);
    if (parsedQuantity === null || (threshold.trim() !== '' && parsedThreshold === null)) {
      setFormError('Enter amounts with up to three decimal places.');
      return;
    }
    setIsSaving(true);
    try {
      await updatePantryStock(item.id, {
        quantity: parsedQuantity,
        lowStockThreshold: parsedThreshold,
        autoRestock,
        expiresOn: expiresOn || null,
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this pantry stock.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
          <DialogTitle>Adjust pantry stock</DialogTitle>
          <DialogDescription>Correct the current amount or update its alerts. Add new pantry items from a grocery purchase.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-2">
              <Label>Grocery item</Label>
              <div className="flex h-10 min-w-0 items-center rounded-md border bg-muted/30 px-3 text-sm">
                <span className="min-w-0 truncate font-medium">{item.itemName}</span>
                <span className="ml-auto shrink-0 pl-3 text-muted-foreground">{item.unit}</span>
              </div>
            </div>

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
                <span className="w-20 shrink-0 truncate text-sm text-muted-foreground">{item.unit}</span>
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
                <span className="w-20 shrink-0 truncate text-sm text-muted-foreground">{item.unit}</span>
              </div>
            </Label>

            <Label htmlFor="pantry-expires-on" className="grid gap-2 text-sm font-medium">
              Expiry date <span className="font-normal text-muted-foreground">· optional</span>
              <Input
                id="pantry-expires-on"
                type="date"
                className="h-10 w-full"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
                disabled={isSaving}
              />
            </Label>
            <p className="-mt-2 text-xs leading-5 text-muted-foreground">This date applies to the tracked item and unit quantity. Purchases leave it unchanged because receipts do not include expiry dates.</p>

            <label htmlFor="pantry-auto-restock" className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/20 p-3.5">
              <Input
                id="pantry-auto-restock"
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border-input p-0 accent-primary shadow-none focus-visible:ring-2 focus-visible:ring-ring"
                checked={autoRestock}
                onChange={(event) => setAutoRestock(event.target.checked)}
                disabled={isSaving}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">Automatically add future purchases</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  Matching receipt items in the same unit increase this quantity. Past purchases are not added.
                </span>
              </span>
            </label>

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
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
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
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<PantryStockStatus | ''>('');
  const [pageNumber, setPageNumber] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
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
  const today = philippineDateString();

  return (
    <section aria-labelledby="pantry-stock-title" className="space-y-5">
      <div className="space-y-1.5">
        <Badge variant="secondary" className="w-fit gap-1.5"><PackageCheck aria-hidden="true" className="size-4" /> Household stock</Badge>
        <div>
          <h2 id="pantry-stock-title" className="text-2xl font-semibold tracking-tight">Pantry stock</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Keep current quantities visible and know when household staples are running low.</p>
        </div>
      </div>

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
                  : 'Pantry items are added from grocery receipts. Record a purchase and choose to add its items to pantry stock.'}
              </p>
              {page.total === 0 && (
                <Button asChild className="mt-4" variant="outline">
                  <a href="#grocery-spending">Go to Grocery spending</a>
                </Button>
              )}
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
                          {stock.autoRestock && <Badge variant="secondary" className="mt-1 h-5 px-1.5 text-[10px]">Auto-restock</Badge>}
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
                        <div className="mt-1 flex justify-end"><ExpiryDisplay expiresOn={stock.expiresOn} today={today} /></div>
                        <p className="mt-1">Updated {formatUpdatedAt(stock.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2 border-t pt-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditingItem(stock)}>
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

      {editingItem && (
        <PantryStockFormDialog
          item={editingItem}
          onOpenChange={(open) => { if (!open) setEditingItem(null); }}
          onSaved={() => {
            setEditingItem(null);
            setRefreshKey((current) => current + 1);
          }}
        />
      )}

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
