import { ArrowLeft, ArrowRight, ReceiptText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { Purchase, PurchasePage } from '@/lib/api';

type PurchaseHistoryState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: PurchasePage }
  | { kind: 'error'; message: string };

type PurchaseHistoryProps = {
  state: PurchaseHistoryState;
  pageNumber: number;
  pageSize: number;
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
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 p-4 sm:p-5">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            <time dateTime={purchase.purchasedOn}>{formatPurchaseDate(purchase.purchasedOn)}</time>
          </p>
          <CardTitle className="text-base">{purchase.storeName || 'Grocery trip'}</CardTitle>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Receipt total</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatCentavos(purchase.totalPaidCentavos)}</p>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-0 sm:px-5">
        <Separator />
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
        <Separator />
      </CardContent>

      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <span className="text-xs text-muted-foreground">{purchase.items.length} {purchase.items.length === 1 ? 'item' : 'items'}</span>
        <Badge variant={purchase.unallocatedAmountCentavos === 0 ? 'secondary' : 'outline'}>
          {purchase.unallocatedAmountCentavos === 0
            ? 'Receipt lines match total'
            : `Unallocated ${formatCentavos(purchase.unallocatedAmountCentavos)}`}
        </Badge>
      </div>
    </Card>
  );
}

export default function PurchaseHistory({
  state,
  pageNumber,
  pageSize,
  onPageChange,
  onRetry,
}: PurchaseHistoryProps) {
  const pageData = state.kind === 'loaded' ? state.page : null;
  const totalPages = pageData ? Math.max(1, Math.ceil(pageData.total / pageSize)) : 1;
  const pageSpend = pageData?.items.reduce((sum, purchase) => sum + purchase.totalPaidCentavos, 0) ?? 0;

  return (
    <section aria-labelledby="purchase-history-title" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Badge variant="secondary" className="w-fit">Your records</Badge>
          <h2 id="purchase-history-title" className="text-2xl font-semibold tracking-tight">Purchase history</h2>
          <p className="text-sm text-muted-foreground">Receipts and the prices recorded on each trip.</p>
        </div>
        {pageData && <p className="text-sm text-muted-foreground">{pageData.total} {pageData.total === 1 ? 'receipt' : 'receipts'}</p>}
      </div>

      {pageData && pageData.total > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription>Receipts on this page</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{pageData.items.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardDescription>Spend on this page</CardDescription>
              <CardTitle className="text-lg tabular-nums sm:text-2xl">{formatCentavos(pageSpend)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <div className="space-y-3" aria-live="polite">
        {state.kind === 'loading' && (
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

        {state.kind === 'error' && (
          <Alert variant="destructive">
            <ReceiptText aria-hidden="true" />
            <AlertTitle>History could not load</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{state.message}</p>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button>
            </AlertDescription>
          </Alert>
        )}

        {pageData && pageData.items.length === 0 && (
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

        {pageData?.items.map((purchase) => <PurchaseCard key={purchase.id} purchase={purchase} />)}
      </div>

      {pageData && pageData.total > 0 && totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Purchase history pages">
          <Button variant="outline" size="sm" onClick={() => onPageChange(pageNumber - 1)} disabled={pageNumber <= 1 || state.kind === 'loading'}>
            <ArrowLeft aria-hidden="true" /> Previous
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">Page {pageNumber} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => onPageChange(pageNumber + 1)} disabled={pageNumber >= totalPages || state.kind === 'loading'}>
            Next <ArrowRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </section>
  );
}

export type { PurchaseHistoryState };
