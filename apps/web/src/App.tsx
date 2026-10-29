import { useEffect, useState } from 'react';
import GroceryCatalog from './components/GroceryCatalog';
import PurchaseForm from './components/PurchaseForm';
import PurchaseHistory, { type PurchaseHistoryState } from './components/PurchaseHistory';
import { createPurchase, fetchHealthStatus, fetchPurchases, type CreatePurchaseRequest, type HealthResponse } from './lib/api';

type ConnectionState =
  | { kind: 'checking' }
  | { kind: 'connected'; health: HealthResponse }
  | { kind: 'error'; message: string };

type NavigationItem = {
  href: string;
  label: string;
  icon: 'overview' | 'add' | 'history' | 'prices';
};

const navigationItems: NavigationItem[] = [
  { href: '#overview', label: 'Overview', icon: 'overview' },
  { href: '#new-purchase', label: 'Add purchase', icon: 'add' },
  { href: '#purchase-history', label: 'Purchase history', icon: 'history' },
  { href: '#grocery-catalog', label: 'Items & prices', icon: 'prices' },
];

const pageSize = 20;

function Brand() {
  return (
    <a href="#overview" className="flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2d6a4f]">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#dcebdc] sm:h-11 sm:w-11">
        <svg aria-hidden="true" viewBox="0 0 40 40" className="h-6 w-6 sm:h-7 sm:w-7" fill="none">
          <path d="M8 16h24l-2.2 15H10.2L8 16Z" stroke="#285E49" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="m14 16 4-8m8 8-4-8M9.2 22h21.6M15 22v7m5-7v7m5-7v7" stroke="#285E49" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span>
        <span className="block text-base font-semibold tracking-tight text-[#203b30] sm:text-lg">Basketwise</span>
        <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-[#6d7c70]">Household food costs</span>
      </span>
    </a>
  );
}

function NavigationIcon({ icon }: { icon: NavigationItem['icon'] }) {
  if (icon === 'overview') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (icon === 'add') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }

  if (icon === 'history') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M5 6.5h14M5 12h14M5 17.5h14" />
        <circle cx="3" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="3" cy="12" r=".5" fill="currentColor" />
        <circle cx="3" cy="17.5" r=".5" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="m4 7 7.8-3 8.7 8.7-8.1 8.1-8.7-8.7L4 7Z" />
      <circle cx="8.2" cy="8.2" r="1.1" />
    </svg>
  );
}

function SectionNavigation({
  activeHref,
  onNavigate,
}: {
  activeHref: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main menu" className="grid gap-1">
      {navigationItems.map((item) => {
        const isActive = activeHref === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? 'location' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47765d] ${isActive ? 'bg-[#e5efe1] text-[#285b40]' : 'text-[#68796d] hover:bg-white/80 hover:text-[#2d4a38]'}`}
          >
            <span className={isActive ? 'text-[#47765d]' : 'text-[#87968a]'}>
              <NavigationIcon icon={item.icon} />
            </span>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>({ kind: 'checking' });
  const [connectionCheck, setConnectionCheck] = useState(0);
  const [history, setHistory] = useState<PurchaseHistoryState>({ kind: 'loading' });
  const [pageNumber, setPageNumber] = useState(1);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const currentSectionLabel = navigationItems.find((item) => item.href === activeHref)?.label ?? 'Overview';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f6ef] text-[#1d342b]">
      <div className="pointer-events-none absolute -left-40 top-44 h-80 w-80 rounded-full bg-[#e3eddb] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-[38rem] h-96 w-96 rounded-full bg-[#e8ead9] opacity-70 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#d9e0d5] bg-[#f8f9f4]/90 px-5 py-6 lg:flex">
          <Brand />
          <p className="mb-3 mt-10 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#97a196]">Workspace</p>
          <SectionNavigation activeHref={activeHref} />
          <div className="mt-auto border-t border-[#e1e6de] pt-5">
            <p className="text-xs font-medium text-[#607166]">Your grocery notebook</p>
            <p className="mt-1 text-[11px] leading-5 text-[#8a978d]">Receipts, items, and prices in one place.</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[#d9e0d5] bg-[#f5f6ef]/95 px-4 backdrop-blur sm:px-7 lg:px-9">
            <div className="flex min-h-[72px] items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d9e0d5] bg-white text-[#345641] transition hover:bg-[#f6f9f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47765d] lg:hidden"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-section-menu"
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                >
                  {mobileMenuOpen ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
                <div className="lg:hidden"><Brand /></div>
                <div className="hidden lg:block">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a978d]">Basketwise workspace</p>
                  <p className="mt-1 text-sm font-semibold text-[#30483a]">{currentSectionLabel}</p>
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

            <div
              id="mobile-section-menu"
              className={`border-t border-[#e1e6de] py-3 lg:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}
            >
              <SectionNavigation
                activeHref={activeHref}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>
          </header>

          <main className="flex-1 px-4 pb-10 pt-7 sm:px-7 sm:pb-14 sm:pt-9 lg:px-9 lg:pt-10">
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
          </main>

          <footer className="mx-4 flex flex-col gap-2 border-t border-[#d9e0d5] py-5 text-[11px] text-[#849087] sm:mx-7 sm:flex-row sm:items-center sm:justify-between lg:mx-9">
            <span>Basketwise · A personal food cost system</span>
            <span>Units saved as entered</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
