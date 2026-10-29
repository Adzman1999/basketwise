import { useEffect, useState } from 'react';
import AppSidebar from '@/components/AppSidebar';
import GroceryCatalog from '@/components/GroceryCatalog';
import PurchaseForm from '@/components/PurchaseForm';
import PurchaseHistory, { type PurchaseHistoryState } from '@/components/PurchaseHistory';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { createPurchase, fetchHealthStatus, fetchPurchases, type CreatePurchaseRequest, type HealthResponse } from '@/lib/api';

type ConnectionState =
  | { kind: 'checking' }
  | { kind: 'connected'; health: HealthResponse }
  | { kind: 'error'; message: string };

const pageSize = 20;

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>({ kind: 'checking' });
  const [connectionCheck, setConnectionCheck] = useState(0);
  const [history, setHistory] = useState<PurchaseHistoryState>({ kind: 'loading' });
  const [pageNumber, setPageNumber] = useState(1);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [activeHref, setActiveHref] = useState(() => window.location.hash || '#overview');

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
    const controller = new AbortController();
    setHistory({ kind: 'loading' });

    void fetchPurchases(pageNumber, pageSize, controller.signal)
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
  }, [pageNumber, historyRefresh]);

  useEffect(() => {
    const updateActiveSection = () => setActiveHref(window.location.hash || '#overview');
    window.addEventListener('hashchange', updateActiveSection);
    return () => window.removeEventListener('hashchange', updateActiveSection);
  }, []);

  async function savePurchase(input: CreatePurchaseRequest) {
    await createPurchase(input);
    setPageNumber(1);
    setHistoryRefresh((current) => current + 1);
    setCatalogRefresh((current) => current + 1);
  }

  const connectionLabel = connection.kind === 'connected'
    ? 'API connected'
    : connection.kind === 'checking'
      ? 'Checking API'
      : 'API unavailable';
  const currentSectionLabel = activeHref === '#new-purchase'
    ? 'Add purchase'
    : activeHref === '#purchase-history'
      ? 'Purchase history'
      : activeHref === '#grocery-catalog'
        ? 'Items & prices'
        : 'Overview';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f6ef] text-[#1d342b]">
      <div className="pointer-events-none absolute -left-40 top-44 h-80 w-80 rounded-full bg-[#e3eddb] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-[38rem] h-96 w-96 rounded-full bg-[#e8ead9] opacity-70 blur-3xl" />

      <SidebarProvider defaultOpen className="relative min-h-screen w-full bg-transparent">
        <AppSidebar activeHref={activeHref} />
        <SidebarInset className="min-h-screen bg-[#f5f6ef]">
          <header className="sticky top-0 z-30 border-b border-[#d9e0d5] bg-[#f5f6ef]/95 px-4 backdrop-blur sm:px-7 lg:px-9">
            <div className="mx-auto flex min-h-[72px] max-w-[1600px] items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="h-10 w-10 rounded-xl border border-[#d9e0d5] bg-white text-[#345641] hover:bg-[#f6f9f3]" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a978d]">Basketwise workspace</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#30483a]">{currentSectionLabel}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConnectionCheck((current) => current + 1)}
                disabled={connection.kind === 'checking'}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#d9e0d5] bg-white/80 px-3 py-2 text-[11px] font-medium text-[#53645a] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47765d] disabled:cursor-wait"
                aria-live="polite"
                title={connection.kind === 'error' ? connection.message : 'Check API connection'}
              >
                <span className={`h-2 w-2 rounded-full ${connection.kind === 'connected' ? 'bg-[#5c9666]' : connection.kind === 'checking' ? 'animate-pulse bg-[#b18a2f]' : 'bg-[#bd5b49]'}`} />
                <span className="hidden sm:inline">{connectionLabel}</span>
                <span className="sm:hidden">{connection.kind === 'connected' ? 'Online' : connection.kind === 'checking' ? 'Checking' : 'Offline'}</span>
              </button>
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-10 pt-7 sm:px-7 sm:pb-14 sm:pt-9 lg:px-9 lg:pt-10">
            <section id="overview" className="mb-7 flex scroll-mt-24 flex-col justify-between gap-4 sm:mb-9 sm:flex-row sm:items-end">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f8874]">Overview</p>
                <h1 className="mt-1.5 text-3xl font-semibold leading-tight tracking-[-0.04em] text-[#203b30] sm:text-4xl">
                  Grocery spending
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#718075]">
                  Keep receipts, item costs, and price history organized for your household.
                </p>
              </div>
              <a href="#new-purchase" className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#1d503b] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#17412f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d503b]">
                <span aria-hidden="true">＋</span>
                Add a purchase
              </a>
            </section>

            <div className="grid items-start gap-7 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] lg:gap-9">
              <div id="new-purchase" className="scroll-mt-24">
                <PurchaseForm onSubmit={savePurchase} />
              </div>
              <div id="purchase-history" className="scroll-mt-24">
                <PurchaseHistory
                  state={history}
                  pageNumber={pageNumber}
                  pageSize={pageSize}
                  onPageChange={setPageNumber}
                  onRetry={() => setHistoryRefresh((current) => current + 1)}
                />
              </div>
            </div>

            <div className="mt-10 border-t border-[#dce3d9] pt-8 sm:mt-12 sm:pt-10">
              <GroceryCatalog refreshKey={catalogRefresh} />
            </div>

            <footer className="mt-8 flex flex-col gap-2 border-t border-[#d9e0d5] py-5 text-[11px] text-[#849087] sm:flex-row sm:items-center sm:justify-between">
              <span>Basketwise · A personal food cost system</span>
              <span>Units saved as entered</span>
            </footer>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
