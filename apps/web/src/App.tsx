import { useEffect, useState } from 'react';
import PurchaseForm from './components/PurchaseForm';
import PurchaseHistory, { type PurchaseHistoryState } from './components/PurchaseHistory';
import { createPurchase, fetchHealthStatus, fetchPurchases, type CreatePurchaseRequest, type HealthResponse } from './lib/api';

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

  async function savePurchase(input: CreatePurchaseRequest) {
    await createPurchase(input);
    setPageNumber(1);
    setHistoryRefresh((current) => current + 1);
  }

  const connectionLabel = connection.kind === 'connected'
    ? 'API connected'
    : connection.kind === 'checking'
      ? 'Checking API'
      : 'API unavailable';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f6ef] text-[#1d342b]">
      <div className="pointer-events-none absolute -left-40 top-44 h-80 w-80 rounded-full bg-[#e3eddb] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-[38rem] h-96 w-96 rounded-full bg-[#e8ead9] opacity-70 blur-3xl" />

      <div className="relative mx-auto min-h-screen max-w-7xl px-4 sm:px-7 lg:px-9">
        <header className="flex items-center justify-between border-b border-[#d9e0d5] py-4 sm:py-5">
          <a href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2d6a4f]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#dcebdc] sm:h-11 sm:w-11">
              <svg aria-hidden="true" viewBox="0 0 40 40" className="h-6 w-6 sm:h-7 sm:w-7" fill="none">
                <path d="M8 16h24l-2.2 15H10.2L8 16Z" stroke="#285E49" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="m14 16 4-8m8 8-4-8M9.2 22h21.6M15 22v7m5-7v7m5-7v7" stroke="#285E49" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span>
              <span className="block text-base font-semibold tracking-tight sm:text-lg">Basketwise</span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-[#6d7c70]">Home food costs</span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setConnectionCheck((current) => current + 1)}
              disabled={connection.kind === 'checking'}
              className="inline-flex items-center gap-2 rounded-full border border-[#d9e0d5] bg-white/70 px-3 py-2 text-[11px] font-medium text-[#53645a] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47765d] disabled:cursor-wait"
              aria-live="polite"
              title={connection.kind === 'error' ? connection.message : 'Check API connection'}
            >
              <span className={`h-2 w-2 rounded-full ${connection.kind === 'connected' ? 'bg-[#5c9666]' : connection.kind === 'checking' ? 'animate-pulse bg-[#b18a2f]' : 'bg-[#bd5b49]'}`} />
              <span className="hidden sm:inline">{connectionLabel}</span>
              <span className="sm:hidden">{connection.kind === 'connected' ? 'Online' : connection.kind === 'checking' ? 'Checking' : 'Offline'}</span>
            </button>
            <a href="#purchase-history" className="hidden rounded-full bg-[#1d503b] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#17412f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d503b] sm:inline-flex">
              View history
            </a>
          </div>
        </header>

        <main className="pb-12 pt-8 sm:pb-16 sm:pt-12">
          <section className="mb-8 flex flex-col justify-between gap-5 sm:mb-10 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full bg-[#e5eddf] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#41664d]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#6a9c70]" />
                Your grocery notebook
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-[#203b30] sm:text-5xl lg:text-6xl">
                Every shop, at a glance.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#617066] sm:text-base sm:leading-7">
                Save a receipt total and its item costs. Your history makes food spending easier to follow, one shop at a time.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#77847a]">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#477253] shadow-sm" aria-hidden="true">₱</span>
              <span>Amounts recorded in Philippine pesos</span>
            </div>
          </section>

          <div className="grid items-start gap-7 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] lg:gap-9">
            <PurchaseForm onSubmit={savePurchase} />
            <div id="purchase-history" className="scroll-mt-6">
              <PurchaseHistory
                state={history}
                pageNumber={pageNumber}
                pageSize={pageSize}
                onPageChange={setPageNumber}
                onRetry={() => setHistoryRefresh((current) => current + 1)}
              />
            </div>
          </div>
        </main>

        <footer className="flex flex-col gap-2 border-t border-[#d9e0d5] py-5 text-[11px] text-[#849087] sm:flex-row sm:items-center sm:justify-between">
          <span>Basketwise · A personal food cost system</span>
          <span>PHP amounts · Units saved as entered</span>
        </footer>
      </div>
    </div>
  );
}
