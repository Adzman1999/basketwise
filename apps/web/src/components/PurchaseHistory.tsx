import type { Purchase, PurchasePage } from '../lib/api';

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
    <article className="rounded-2xl border border-[#e1e8df] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <time dateTime={purchase.purchasedOn} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#77907c]">
            {formatPurchaseDate(purchase.purchasedOn)}
          </time>
          <h3 className="mt-1 text-base font-semibold text-[#284235]">
            {purchase.storeName || 'Grocery trip'}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#859188]">Receipt total</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-[#203b30]">
            {formatCentavos(purchase.totalPaidCentavos)}
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-[#edf0eb] border-y border-[#edf0eb]">
        {purchase.items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-[#3f5447]">{item.itemName}</p>
              <p className="mt-0.5 text-xs text-[#89958c]">{item.quantity} {item.unit}</p>
            </div>
            <span className="shrink-0 font-medium tabular-nums text-[#445a4b]">
              {formatCentavos(item.amountPaidCentavos)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 text-xs">
        <span className="text-[#7b897e]">{purchase.items.length} {purchase.items.length === 1 ? 'item' : 'items'}</span>
        <span className={purchase.unallocatedAmountCentavos === 0 ? 'font-medium text-[#527257]' : 'font-medium text-[#7a6852]'}>
          {purchase.unallocatedAmountCentavos === 0
            ? 'Receipt lines match total'
            : `Unallocated ${formatCentavos(purchase.unallocatedAmountCentavos)}`}
        </span>
      </div>
    </article>
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
    <section aria-labelledby="purchase-history-title" className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f8874]">Your records</p>
          <h2 id="purchase-history-title" className="mt-1 text-2xl font-semibold tracking-tight text-[#203b30]">Purchase history</h2>
        </div>
        {pageData && pageData.total > 0 && (
          <p className="text-xs text-[#7f8b82]">
            {pageData.total} {pageData.total === 1 ? 'receipt' : 'receipts'} recorded
          </p>
        )}
      </div>

      {pageData && pageData.total > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#dfe6dd] bg-[#f9fbf7] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#829087]">Receipts on this page</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-[#274333]">{pageData.items.length}</p>
          </div>
          <div className="rounded-2xl border border-[#dfe6dd] bg-[#f9fbf7] px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#829087]">Spend on this page</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-[#274333]">{formatCentavos(pageSpend)}</p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {state.kind === 'loading' && (
          <div className="rounded-2xl border border-dashed border-[#cfdacf] bg-white/60 px-5 py-12 text-center" role="status">
            <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-[#cbd9c9] border-t-[#2d6a4f]" />
            <p className="mt-3 text-sm text-[#718075]">Loading purchase history…</p>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="rounded-2xl border border-[#f0d8d1] bg-[#fff8f5] px-5 py-8 text-center">
            <p className="text-sm font-semibold text-[#7e4539]">History could not load</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8b625a]">{state.message}</p>
            <button
              className="mt-4 rounded-lg border border-[#dcbab1] px-3.5 py-2 text-xs font-semibold text-[#74483e] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c5b49]"
              type="button"
              onClick={onRetry}
            >
              Try again
            </button>
          </div>
        )}

        {pageData && pageData.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#cfdacf] bg-white/60 px-5 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f0e3] text-xl text-[#477253]" aria-hidden="true">＋</span>
            <h3 className="mt-4 text-base font-semibold text-[#365343]">Your first receipt starts here</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#7b897e]">
              Add a grocery purchase to start tracking what you spend and what each item costs.
            </p>
          </div>
        )}

        {pageData?.items.map((purchase) => <PurchaseCard key={purchase.id} purchase={purchase} />)}
      </div>

      {pageData && pageData.total > 0 && totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-between gap-4" aria-label="Purchase history pages">
          <button
            className="rounded-lg border border-[#d9e2d7] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#49634f] transition hover:bg-[#f4f8f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47765d] disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            onClick={() => onPageChange(pageNumber - 1)}
            disabled={pageNumber <= 1 || state.kind === 'loading'}
          >
            ← Previous
          </button>
          <span className="text-xs tabular-nums text-[#7b897e]">Page {pageNumber} of {totalPages}</span>
          <button
            className="rounded-lg border border-[#d9e2d7] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#49634f] transition hover:bg-[#f4f8f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47765d] disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            onClick={() => onPageChange(pageNumber + 1)}
            disabled={pageNumber >= totalPages || state.kind === 'loading'}
          >
            Next →
          </button>
        </nav>
      )}
    </section>
  );
}

export type { PurchaseHistoryState };
