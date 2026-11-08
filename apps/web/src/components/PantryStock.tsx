import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarDays,
  PackageCheck,
  PackageX,
  Pencil,
  Plus,
  ReceiptText,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { philippineDateString } from '@/lib/dates';
import {
  addPurchaseItemsToPantry,
  deletePantryStock,
  fetchPurchasesNeedingPantry,
  fetchPantryStock,
  updatePantryStock,
  type PantryStockItem,
  type PantryStockStatus,
} from '@/lib/api';

type PantryStockState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: Awaited<ReturnType<typeof fetchPantryStock>> }
  | { kind: 'error'; message: string };

type PendingPurchasesState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: Awaited<ReturnType<typeof fetchPurchasesNeedingPantry>> }
  | { kind: 'error'; message: string };

const pageSize = 12;
const pendingPurchasePageSize = 5;
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
  const [pendingPurchaseState, setPendingPurchaseState] = useState<PendingPurchasesState>({ kind: 'loading' });
  const [pendingPageNumber, setPendingPageNumber] = useState(1);
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0);
  const [selectedPendingPurchaseIds, setSelectedPendingPurchaseIds] = useState<string[]>([]);
  const [isAddingPendingPurchases, setIsAddingPendingPurchases] = useState(false);
  const [pendingActionError, setPendingActionError] = useState('');
  const [pendingActionNotice, setPendingActionNotice] = useState('');
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

  useEffect(() => {
    const controller = new AbortController();
    setPendingPurchaseState({ kind: 'loading' });
    void fetchPurchasesNeedingPantry(pendingPageNumber, pendingPurchasePageSize, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setPendingPurchaseState({ kind: 'loaded', page });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPendingPurchaseState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load purchases to review.' });
      });
    return () => controller.abort();
  }, [pendingPageNumber, pendingRefreshKey]);

  function togglePendingPurchase(purchaseId: string) {
    setPendingActionError('');
    setPendingActionNotice('');
    setSelectedPendingPurchaseIds((current) => current.includes(purchaseId)
      ? current.filter((id) => id !== purchaseId)
      : [...current, purchaseId]);
  }

  async function addSelectedPurchasesToPantry() {
    if (selectedPendingPurchaseIds.length === 0) return;
    setIsAddingPendingPurchases(true);
    setPendingActionError('');
    setPendingActionNotice('');

    let changedItemCount = 0;
    const failedPurchaseIds: string[] = [];
    for (const purchaseId of selectedPendingPurchaseIds) {
      try {
        const changedItems = await addPurchaseItemsToPantry(purchaseId);
        changedItemCount += changedItems.length;
      } catch {
        failedPurchaseIds.push(purchaseId);
      }
    }

    setSelectedPendingPurchaseIds(failedPurchaseIds);
    setPendingPageNumber(1);
    setPendingRefreshKey((current) => current + 1);
    setRefreshKey((current) => current + 1);
    if (failedPurchaseIds.length > 0) {
      setPendingActionError(`Could not add ${failedPurchaseIds.length} selected ${failedPurchaseIds.length === 1 ? 'receipt' : 'receipts'}. The rest were processed; retry the selected receipts.`);
    }
    if (changedItemCount > 0) {
      setPendingActionNotice(`Added ${changedItemCount} ${changedItemCount === 1 ? 'item' : 'items'} to current pantry stock. Receipt dates remain in purchase history.`);
    } else if (failedPurchaseIds.length === 0) {
      setPendingActionNotice('Those receipt items were already added to pantry stock.');
    }
    setIsAddingPendingPurchases(false);
  }

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
  const pendingPage = pendingPurchaseState.kind === 'loaded' ? pendingPurchaseState.page : null;
  const pendingTotalPages = Math.max(1, Math.ceil((pendingPage?.total ?? 0) / pendingPurchasePageSize));
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

      <Tabs defaultValue="pantry" className="space-y-3">
        <TabsList className="grid h-10 w-full grid-cols-2 sm:inline-flex sm:w-auto" aria-label="Pantry stock sections">
          <TabsTrigger value="pantry" className="min-w-0 gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm">
            <Boxes aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">Your pantry</span>
          </TabsTrigger>
          <TabsTrigger value="review" className="min-w-0 gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm">
            <ReceiptText aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">Purchases to review</span>
            {(pendingPage?.total ?? 0) > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] leading-none text-primary">
                {pendingPage?.total}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-0">
          {(pendingPurchaseState.kind !== 'loaded' || (pendingPage?.total ?? 0) > 0 || Boolean(pendingActionNotice || pendingActionError)) && (
            <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.035] via-card to-card shadow-none">
              <CardHeader className="space-y-2 p-3 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ReceiptText aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-sm">Purchases to review</CardTitle>
                    <CardDescription className="mt-0.5 text-xs">Select receipts for items still on hand.</CardDescription>
                  </div>
                </div>
                <p className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px] leading-4 text-muted-foreground">
                  <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
                  <span>Receipt dates stay in history; additions update stock now.</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0 sm:p-4 sm:pt-0">
                {pendingActionNotice && (
                  <Alert>
                    <PackageCheck aria-hidden="true" />
                    <AlertTitle>Pantry updated</AlertTitle>
                    <AlertDescription>{pendingActionNotice}</AlertDescription>
                  </Alert>
                )}

                {pendingActionError && (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>Some receipts could not be added</AlertTitle>
                    <AlertDescription>{pendingActionError}</AlertDescription>
                  </Alert>
                )}

                {pendingPurchaseState.kind === 'loading' && (
                  <div className="space-y-1.5" role="status" aria-label="Loading purchases to review">
                    <Skeleton className="h-14" /><Skeleton className="h-14" />
                  </div>
                )}

                {pendingPurchaseState.kind === 'error' && (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>Purchases to review could not load</AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                      <span>{pendingPurchaseState.message}</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => setPendingRefreshKey((current) => current + 1)}>Try again</Button>
                    </AlertDescription>
                  </Alert>
                )}

                {pendingPage && pendingPage.items.length > 0 && (
                  <div className="space-y-1.5" aria-live="polite" aria-busy={pendingPurchaseState.kind === 'loading' || isAddingPendingPurchases}>
                    {pendingPage.items.map((purchase) => {
                      const pendingItems = purchase.items.filter((item) => !item.pantryAdded);
                      const isSelected = selectedPendingPurchaseIds.includes(purchase.id);
                      const checkboxId = `review-purchase-${purchase.id}`;
                      return (
                        <label
                          key={purchase.id}
                          htmlFor={checkboxId}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors ${isSelected ? 'border-primary/40 bg-primary/[0.04]' : 'bg-background hover:bg-muted/30'}`}
                        >
                          <Input
                            id={checkboxId}
                            type="checkbox"
                            className="size-4 shrink-0 rounded border-input p-0 accent-primary shadow-none focus-visible:ring-2 focus-visible:ring-ring"
                            checked={isSelected}
                            onChange={() => togglePendingPurchase(purchase.id)}
                            disabled={isAddingPendingPurchases}
                            aria-label={`Select receipt from ${purchase.storeName || 'grocery trip'} dated ${formatDateOnly(purchase.purchasedOn)}`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                              <span className="min-w-0 truncate text-xs font-medium">{purchase.storeName || 'Grocery trip'}</span>
                              <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                                <time dateTime={purchase.purchasedOn}>{formatDateOnly(purchase.purchasedOn)}</time>
                                <span aria-hidden="true">·</span>
                                {pendingItems.length} {pendingItems.length === 1 ? 'item' : 'items'}
                              </span>
                            </span>
                            <span className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-4 text-muted-foreground">
                              {pendingItems.map((item) => (
                                <span key={item.id} className="inline-flex min-w-0 max-w-full items-baseline gap-1">
                                  <span className="max-w-40 truncate font-medium text-foreground">{item.itemName}</span>
                                  <span className="shrink-0">{formatQuantity(item.quantity)} {item.unit}</span>
                                </span>
                              ))}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {pendingPage && pendingPage.total > 0 && (
                  <div className="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-xs text-muted-foreground" aria-live="polite">
                        {selectedPendingPurchaseIds.length > 0
                          ? `${selectedPendingPurchaseIds.length} ${selectedPendingPurchaseIds.length === 1 ? 'receipt' : 'receipts'} selected`
                          : `${pendingPage.total} ${pendingPage.total === 1 ? 'receipt' : 'receipts'} with items not yet in pantry`}
                      </p>
                      {selectedPendingPurchaseIds.length > 0 && (
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelectedPendingPurchaseIds([])} disabled={isAddingPendingPurchases}>
                          Clear selection
                        </Button>
                      )}
                    </div>
                    <Button type="button" className="w-full sm:w-auto" onClick={() => void addSelectedPurchasesToPantry()} disabled={selectedPendingPurchaseIds.length === 0 || isAddingPendingPurchases}>
                      <Plus aria-hidden="true" /> {isAddingPendingPurchases ? 'Adding to pantry…' : 'Add selected to pantry'}
                    </Button>
                  </div>
                )}

                {pendingPage && pendingPage.total > pendingPurchasePageSize && (
                  <nav className="flex items-center justify-between gap-3 border-t pt-2" aria-label="Purchases to review pages">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPendingPageNumber((current) => current - 1)} disabled={pendingPageNumber <= 1 || isAddingPendingPurchases}>
                      <ArrowLeft aria-hidden="true" /> Previous
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground">Showing {(pendingPageNumber - 1) * pendingPurchasePageSize + 1}–{Math.min(pendingPageNumber * pendingPurchasePageSize, pendingPage.total)} of {pendingPage.total} receipts</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => setPendingPageNumber((current) => current + 1)} disabled={pendingPageNumber >= pendingTotalPages || isAddingPendingPurchases}>
                      Next <ArrowRight aria-hidden="true" />
                    </Button>
                  </nav>
                )}
              </CardContent>
            </Card>
          )}

              {pendingPage && pendingPage.total === 0 && !pendingActionNotice && !pendingActionError && (
                <Card className="shadow-none">
                  <CardContent className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center">
                    <span className="mb-2 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <PackageCheck aria-hidden="true" className="size-4" />
                    </span>
                    <p className="text-sm font-medium">No purchases to review</p>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">All receipt items have already been added to pantry stock.</p>
                  </CardContent>
                </Card>
              )}
        </TabsContent>

        <TabsContent value="pantry" className="mt-0">
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
        </TabsContent>
      </Tabs>

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
