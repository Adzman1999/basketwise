import { useEffect, useState } from 'react';
import {
  fetchGroceryItemPriceHistory,
  fetchGroceryItems,
  type GroceryItemPage,
  type PriceHistoryPage,
} from '../lib/api';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: GroceryItemPage }
  | { kind: 'error'; message: string };

type PriceHistoryState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; page: PriceHistoryPage }
  | { kind: 'error'; message: string };

const catalogPageSize = 10;
const priceHistoryPageSize = 10;

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

const unitPriceFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function formatCentavos(amount: number): string {
  return phpFormatter.format(amount / 100);
}

function formatUnitPrice(centavos: number, unit: string): string {
  return `${unitPriceFormatter.format(centavos / 100)} / ${unit}`;
}

function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 }).format(quantity);
}

function formatPurchaseDate(date: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function CatalogPagination({
  page,
  total,
  pageSize,
  label,
  onPageChange,
  disabled,
}: {
  page: number;
  total: number;
  pageSize: number;
  label: string;
  onPageChange: (page: number) => void;
  disabled: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label={label}>
      <button
        className="rounded-lg border border-[#d9e2d7] bg-white px-3 py-2 text-xs font-semibold text-[#49634f] transition hover:bg-[#f4f8f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47765d] disabled:cursor-not-allowed disabled:opacity-40"
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        ← Previous
      </button>
      <span className="text-xs tabular-nums text-[#7b897e]">Page {page} of {totalPages}</span>
      <button
        className="rounded-lg border border-[#d9e2d7] bg-white px-3 py-2 text-xs font-semibold text-[#49634f] transition hover:bg-[#f4f8f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47765d] disabled:cursor-not-allowed disabled:opacity-40"
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        Next →
      </button>
    </nav>
  );
}

export default function GroceryCatalog({ refreshKey }: { refreshKey: number }) {
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogPageNumber, setCatalogPageNumber] = useState(1);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [catalogState, setCatalogState] = useState<CatalogState>({ kind: 'loading' });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [priceHistoryPageNumber, setPriceHistoryPageNumber] = useState(1);
  const [priceHistoryRefresh, setPriceHistoryRefresh] = useState(0);
  const [priceHistoryState, setPriceHistoryState] = useState<PriceHistoryState>({ kind: 'idle' });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchText.trim());
      setCatalogPageNumber(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    setPriceHistoryPageNumber(1);
  }, [selectedItemId]);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogState({ kind: 'loading' });

    void fetchGroceryItems(catalogPageNumber, catalogPageSize, searchQuery, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setCatalogState({ kind: 'loaded', page });
        setSelectedItemId((current) => (
          page.items.some((item) => item.id === current)
            ? current
            : page.items[0]?.id ?? null
        ));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load the grocery catalog.',
        });
      });

    return () => controller.abort();
  }, [catalogPageNumber, catalogRefresh, refreshKey, searchQuery]);

  useEffect(() => {
    if (!selectedItemId) {
      setPriceHistoryState({ kind: 'idle' });
      return;
    }

    const controller = new AbortController();
    setPriceHistoryState({ kind: 'loading' });

    void fetchGroceryItemPriceHistory(
      selectedItemId,
      priceHistoryPageNumber,
      priceHistoryPageSize,
      controller.signal
    )
      .then((page) => {
        if (!controller.signal.aborted) setPriceHistoryState({ kind: 'loaded', page });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPriceHistoryState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load price history.',
        });
      });

    return () => controller.abort();
  }, [selectedItemId, priceHistoryPageNumber, priceHistoryRefresh, refreshKey]);

  const catalogPage = catalogState.kind === 'loaded' ? catalogState.page : null;
  const priceHistoryPage = priceHistoryState.kind === 'loaded' ? priceHistoryState.page : null;
  const selectedItem = catalogPage?.items.find((item) => item.id === selectedItemId) ?? null;

  function selectItem(id: string) {
    setSelectedItemId(id);
    setPriceHistoryPageNumber(1);
  }

  return (
    <section id="grocery-catalog" aria-labelledby="grocery-catalog-title" className="scroll-mt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f8874]">Item insights</p>
          <h2 id="grocery-catalog-title" className="mt-1 text-2xl font-semibold tracking-tight text-[#203b30]">Catalog &amp; price history</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#718075]">
            Browse grocery items from your receipts and compare recorded prices within the same unit.
          </p>
        </div>
        {catalogPage && (
          <p className="text-xs text-[#7f8b82]">
            {catalogPage.total} {catalogPage.total === 1 ? 'item' : 'items'}
          </p>
        )}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
        <section aria-label="Grocery item catalog" className="rounded-[1.5rem] border border-[#dfe6dd] bg-white p-4 shadow-[0_18px_50px_-42px_rgba(23,62,49,0.4)] sm:p-5">
          <label className="block text-xs font-semibold text-[#40574a]" htmlFor="grocery-item-search">
            Search items
          </label>
          <div className="relative mt-2">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b998f]" fill="none">
              <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.6" />
              <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              id="grocery-item-search"
              className="w-full rounded-xl border border-[#dce3d9] bg-white py-3 pl-9 pr-3 text-sm text-[#23392f] outline-none transition placeholder:text-[#9ba79e] focus:border-[#47765d] focus:ring-4 focus:ring-[#47765d]/10"
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by item name"
              maxLength={120}
            />
          </div>

          <div className="mt-3 space-y-2" aria-live="polite">
            {catalogState.kind === 'loading' && (
              <div className="rounded-xl border border-dashed border-[#cfdacf] px-4 py-8 text-center text-sm text-[#718075]" role="status">
                Loading grocery items…
              </div>
            )}
            {catalogState.kind === 'error' && (
              <div className="rounded-xl border border-[#f0d8d1] bg-[#fff8f5] px-4 py-5">
                <p className="text-sm font-semibold text-[#7e4539]">Catalog could not load</p>
                <p className="mt-1 text-sm leading-5 text-[#8b625a]">{catalogState.message}</p>
                <button
                  className="mt-3 rounded-lg border border-[#dcbab1] px-3 py-2 text-xs font-semibold text-[#74483e] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c5b49]"
                  type="button"
                  onClick={() => setCatalogRefresh((current) => current + 1)}
                >
                  Try again
                </button>
              </div>
            )}
            {catalogPage && catalogPage.items.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#cfdacf] bg-[#fafbf8] px-4 py-8 text-center">
                <p className="text-sm font-semibold text-[#365343]">
                  {searchQuery ? 'No matching grocery items' : 'No grocery items yet'}
                </p>
                <p className="mt-1.5 text-sm leading-5 text-[#7b897e]">
                  {searchQuery ? 'Try a different name.' : 'Save a purchase to build your catalog.'}
                </p>
              </div>
            )}
            {catalogPage?.items.map((item) => {
              const isSelected = item.id === selectedItemId;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectItem(item.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47765d] ${isSelected ? 'border-[#9ab99c] bg-[#eff6ec]' : 'border-[#e5eae2] bg-white hover:border-[#c8d8c5] hover:bg-[#fafcf8]'}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#30483a]">{item.name}</span>
                    <span className="mt-0.5 block text-[11px] text-[#87948a]">View price history</span>
                  </span>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-[#d8e9d4] text-[#326147]' : 'bg-[#f2f5ef] text-[#809086]'}`} aria-hidden="true">→</span>
                </button>
              );
            })}
          </div>

          {catalogPage && (
            <CatalogPagination
              page={catalogPageNumber}
              total={catalogPage.total}
              pageSize={catalogPageSize}
              label="Grocery item pages"
              onPageChange={setCatalogPageNumber}
              disabled={catalogState.kind === 'loading'}
            />
          )}
        </section>

        <section aria-label="Selected grocery item price history" className="min-w-0 rounded-[1.5rem] border border-[#dfe6dd] bg-white p-4 shadow-[0_18px_50px_-42px_rgba(23,62,49,0.4)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#829087]">Recorded observations</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#284235]">
                {selectedItem?.name ?? 'Price history'}
              </h3>
            </div>
            {priceHistoryPage && priceHistoryPage.total > 0 && (
              <span className="rounded-full bg-[#edf4e9] px-3 py-1.5 text-[11px] font-semibold text-[#44694e]">
                {priceHistoryPage.total} {priceHistoryPage.total === 1 ? 'record' : 'records'}
              </span>
            )}
          </div>

          <p className="mt-1.5 text-xs leading-5 text-[#829087]">
            Prices are listed by their receipt unit. Different units are kept separate.
          </p>

          <div className="mt-4 space-y-2.5" aria-live="polite">
            {selectedItemId && priceHistoryState.kind === 'loading' && (
              <div className="rounded-xl border border-dashed border-[#cfdacf] px-4 py-10 text-center text-sm text-[#718075]" role="status">
                Loading price history…
              </div>
            )}
            {selectedItemId && priceHistoryState.kind === 'error' && (
              <div className="rounded-xl border border-[#f0d8d1] bg-[#fff8f5] px-4 py-6">
                <p className="text-sm font-semibold text-[#7e4539]">Price history could not load</p>
                <p className="mt-1 text-sm leading-5 text-[#8b625a]">{priceHistoryState.message}</p>
                <button
                  className="mt-3 rounded-lg border border-[#dcbab1] px-3 py-2 text-xs font-semibold text-[#74483e] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c5b49]"
                  type="button"
                  onClick={() => setPriceHistoryRefresh((current) => current + 1)}
                >
                  Try again
                </button>
              </div>
            )}
            {!selectedItemId && catalogState.kind === 'loaded' && (
              <div className="rounded-xl border border-dashed border-[#cfdacf] bg-[#fafbf8] px-4 py-10 text-center">
                <p className="text-sm font-semibold text-[#365343]">Select an item to view its prices</p>
                <p className="mt-1.5 text-sm leading-5 text-[#7b897e]">Price records come from saved receipt lines.</p>
              </div>
            )}
            {priceHistoryPage?.items.map((observation) => (
              <article key={observation.purchaseItemId} className="rounded-xl border border-[#e5eae2] bg-[#fcfdfa] px-3.5 py-3.5 sm:px-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <time dateTime={observation.purchasedOn} className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#77907c]">
                      {formatPurchaseDate(observation.purchasedOn)}
                    </time>
                    <p className="mt-1 truncate text-sm font-semibold text-[#30483a]">
                      {observation.storeName || 'Grocery trip'}
                    </p>
                    {observation.itemName !== priceHistoryPage.groceryItem.name && (
                      <p className="mt-0.5 truncate text-[11px] text-[#89958c]">Receipt label: {observation.itemName}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#859188]">Line paid</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-[#30483a]">
                      {formatCentavos(observation.amountPaidCentavos)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0eb] pt-3 text-xs">
                  <span className="text-[#718075]">
                    {formatQuantity(observation.quantity)} {observation.unit}
                  </span>
                  <span className="font-semibold tabular-nums text-[#41664d]">
                    {formatUnitPrice(observation.unitPriceCentavos, observation.unit)}
                  </span>
                </div>
              </article>
            ))}
            {priceHistoryPage && priceHistoryPage.total === 0 && (
              <div className="rounded-xl border border-dashed border-[#cfdacf] bg-[#fafbf8] px-4 py-10 text-center">
                <p className="text-sm font-semibold text-[#365343]">No price observations found</p>
              </div>
            )}
          </div>

          {priceHistoryPage && (
            <CatalogPagination
              page={priceHistoryPageNumber}
              total={priceHistoryPage.total}
              pageSize={priceHistoryPageSize}
              label="Price history pages"
              onPageChange={setPriceHistoryPageNumber}
              disabled={priceHistoryState.kind === 'loading'}
            />
          )}
        </section>
      </div>
    </section>
  );
}
