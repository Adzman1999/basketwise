import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, CirclePlus, RefreshCw } from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import GroceryCatalog from '@/components/GroceryCatalog';
import PurchaseForm from '@/components/PurchaseForm';
import PurchaseHistory, { type PurchaseHistoryState } from '@/components/PurchaseHistory';
import StoresAndShops from '@/components/StoresAndShops';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { createPurchase, fetchHealthStatus, fetchPurchases, type CreatePurchaseRequest, type HealthResponse, type PurchaseFilters } from '@/lib/api';

type ConnectionState =
  | { kind: 'checking' }
  | { kind: 'connected'; health: HealthResponse }
  | { kind: 'error'; message: string };

const pageSize = 20;
const emptyPurchaseFilters: PurchaseFilters = { search: '', store: '', from: '', to: '' };

function samePurchaseFilters(left: PurchaseFilters, right: PurchaseFilters): boolean {
  return left.search === right.search
    && left.store === right.store
    && left.from === right.from
    && left.to === right.to;
}

function getActiveHref(): string {
  const hash = window.location.hash;
  if (hash === '#purchase-history' || hash === '#new-purchase') return '#grocery-spending';
  if (hash === '#grocery-spending' || hash === '#grocery-catalog' || hash === '#stores') return hash;
  return '#overview';
}

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>({ kind: 'checking' });
  const [connectionCheck, setConnectionCheck] = useState(0);
  const [history, setHistory] = useState<PurchaseHistoryState>({ kind: 'loading' });
  const [pageNumber, setPageNumber] = useState(1);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [purchaseFilters, setPurchaseFilters] = useState<PurchaseFilters>(emptyPurchaseFilters);
  const [appliedPurchaseFilters, setAppliedPurchaseFilters] = useState<PurchaseFilters>(emptyPurchaseFilters);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [activeHref, setActiveHref] = useState(getActiveHref);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setConnection({ kind: 'checking' });

    void fetchHealthStatus(controller.signal)
      .then((health) => {
        if (!controller.signal.aborted) setConnection({ kind: 'connected', health });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setConnection({
          kind: 'error',
          message: error instanceof Error ? error.message : 'The API is unavailable.',
        });
      });

    return () => controller.abort();
  }, [connectionCheck]);

  useEffect(() => {
    if (activeHref !== '#grocery-spending') return;
    if (appliedPurchaseFilters.from && appliedPurchaseFilters.to && appliedPurchaseFilters.from > appliedPurchaseFilters.to) {
      setHistory({ kind: 'invalid', message: 'The start date must be on or before the end date.' });
      return;
    }

    const controller = new AbortController();
    setHistory({ kind: 'loading' });

    void fetchPurchases(pageNumber, pageSize, appliedPurchaseFilters, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setHistory({ kind: 'loaded', page: data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setHistory({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load purchase history.',
        });
      });

    return () => controller.abort();
  }, [activeHref, pageNumber, historyRefresh, appliedPurchaseFilters]);

  useEffect(() => {
    if (samePurchaseFilters(purchaseFilters, appliedPurchaseFilters)) return;

    const timeout = window.setTimeout(() => {
      setAppliedPurchaseFilters(purchaseFilters);
      setPageNumber(1);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [purchaseFilters, appliedPurchaseFilters]);

  useEffect(() => {
    const updateActiveSection = () => setActiveHref(getActiveHref());
    window.addEventListener('hashchange', updateActiveSection);
    return () => window.removeEventListener('hashchange', updateActiveSection);
  }, []);

  async function savePurchase(input: CreatePurchaseRequest) {
    await createPurchase(input);
    setPageNumber(1);
    setHistoryRefresh((current) => current + 1);
    setCatalogRefresh((current) => current + 1);
    setPurchaseDialogOpen(false);
  }

  const connectionLabel = connection.kind === 'connected'
    ? 'API connected'
    : connection.kind === 'checking'
      ? 'Checking API'
      : 'API unavailable';
  const currentSectionLabel = activeHref === '#grocery-spending'
    ? 'Grocery spending'
    : activeHref === '#grocery-catalog'
      ? 'Items & prices'
      : activeHref === '#stores'
        ? 'Stores & shops'
        : 'Overview';
  const purchaseFiltersPending = !samePurchaseFilters(purchaseFilters, appliedPurchaseFilters);

  return (
    <ThemeProvider>
      <SidebarProvider defaultOpen className="min-h-screen w-full bg-background">
        <AppSidebar activeHref={activeHref} />
        <SidebarInset className="min-h-screen bg-background">
          <header className="sticky top-0 z-30 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-7 lg:px-9">
            <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="shrink-0" />
                <Separator orientation="vertical" className="hidden h-6 sm:block" />
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">Basketwise workspace</p>
                  <p className="truncate text-sm font-medium">{currentSectionLabel}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant={connection.kind === 'error' ? 'destructive' : 'secondary'}
                  className="gap-1.5 px-2.5 py-1"
                  aria-live="polite"
                  title={connection.kind === 'error' ? connection.message : 'Check API connection'}
                >
                  <Activity className={`size-3 ${connection.kind === 'checking' ? 'animate-pulse' : ''}`} aria-hidden="true" />
                  <span className="hidden sm:inline">{connectionLabel}</span>
                  <span className="sm:hidden">{connection.kind === 'connected' ? 'Online' : connection.kind === 'checking' ? 'Checking' : 'Offline'}</span>
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConnectionCheck((current) => current + 1)}
                  disabled={connection.kind === 'checking'}
                  aria-label="Refresh API status"
                  title="Refresh API status"
                >
                  <span className="sr-only">Refresh API status</span>
                  <RefreshCw className="size-4" aria-hidden="true" />
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-10 pt-7 sm:px-7 sm:pb-14 sm:pt-9 lg:px-9 lg:pt-10">
            {activeHref !== '#overview' && (
              <>
                <section className="mb-7 flex scroll-mt-24 flex-col justify-between gap-4 sm:mb-9 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-medium text-primary">
                      {activeHref === '#grocery-catalog' ? 'Items & prices' : activeHref === '#stores' ? 'Places' : 'Household'}
                    </p>
                    <h1 className="mt-1.5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                      {activeHref === '#grocery-catalog'
                        ? 'Grocery items'
                        : activeHref === '#stores'
                          ? 'Stores & shops'
                          : 'Grocery spending'}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      {activeHref === '#grocery-catalog'
                        ? 'Browse saved grocery items and compare their recorded prices.'
                        : activeHref === '#stores'
                          ? 'Save the places you shop and choose them when recording a purchase.'
                          : 'Track grocery receipts and item prices.'}
                    </p>
                  </div>
                  {activeHref === '#grocery-spending' && (
                    <Button onClick={() => setPurchaseDialogOpen(true)}>
                      <CirclePlus aria-hidden="true" />
                      Add a purchase
                      <ArrowUpRight aria-hidden="true" />
                    </Button>
                  )}
                </section>

                {activeHref === '#grocery-catalog' ? (
                  <GroceryCatalog refreshKey={catalogRefresh} />
                ) : activeHref === '#stores' ? (
                  <StoresAndShops />
                ) : (
                  <div id="grocery-spending" className="scroll-mt-24">
                    <PurchaseHistory
                      state={history}
                      pageNumber={pageNumber}
                      pageSize={pageSize}
                      filters={purchaseFilters}
                      filtersPending={purchaseFiltersPending}
                      onFiltersChange={(filters) => {
                        setPurchaseFilters(filters);
                      }}
                      onPageChange={setPageNumber}
                      onRetry={() => setHistoryRefresh((current) => current + 1)}
                    />
                  </div>
                )}

                <Separator className="my-8" />
                <footer className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>Basketwise · A personal food cost system</span>
                  <span>Saved units reused across purchases</span>
                </footer>
              </>
            )}
          </main>
        </SidebarInset>
        <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
          <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[min(90dvh,900px)] sm:max-h-[90dvh] sm:w-[calc(100vw-2rem)] sm:max-w-3xl sm:rounded-lg">
            <DialogHeader className="sticky top-0 z-20 shrink-0 border-b bg-background px-4 py-4 sm:px-6 sm:py-5">
              <DialogTitle>Add a purchase</DialogTitle>
              <DialogDescription>Enter the receipt date and items. The total is calculated from the item amounts.</DialogDescription>
            </DialogHeader>
            <PurchaseForm onSubmit={savePurchase} onCancel={() => setPurchaseDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </SidebarProvider>
    </ThemeProvider>
  );
}
