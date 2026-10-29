import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchGroceryItems, type CreatePurchaseItem, type CreatePurchaseRequest, type GroceryItem } from '../lib/api';

type DraftItem = {
  id: number;
  itemName: string;
  quantity: string;
  unit: string;
  amountPaid: string;
};

type PurchaseFormProps = {
  onSubmit: (purchase: CreatePurchaseRequest) => Promise<void>;
};

const maxCentavos = 2_147_483_647;
const maxPesoAmount = (maxCentavos / 100).toFixed(2);

function todayAsLocalDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parsePesos(value: string): number | null {
  const match = value.trim().match(/^(\d*)(?:\.(\d{0,2}))?$/);
  if (!match || (!match[1] && !match[2])) return null;

  const wholePesos = BigInt(match[1] || '0');
  const centavos = BigInt((match[2] || '').padEnd(2, '0'));
  const totalCentavos = wholePesos * 100n + centavos;

  if (totalCentavos > BigInt(maxCentavos)) return null;
  return Number(totalCentavos);
}

function emptyItem(id: number): DraftItem {
  return { id, itemName: '', quantity: '1', unit: 'item', amountPaid: '' };
}

const inputClassName = 'mt-2 w-full rounded-xl border border-[#dce3d9] bg-white px-3.5 py-3 text-sm text-[#23392f] outline-none transition placeholder:text-[#9ba79e] focus:border-[#47765d] focus:ring-4 focus:ring-[#47765d]/10 disabled:bg-[#f4f6f2]';
const labelClassName = 'block text-xs font-semibold text-[#40574a]';

function CatalogNameInput({
  itemId,
  value,
  onChange,
  disabled,
}: {
  itemId: number;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [suggestions, setSuggestions] = useState<GroceryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const query = value.trim();
  const suggestionsId = `grocery-item-suggestions-${itemId}`;
  const helperId = `grocery-item-helper-${itemId}`;

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsSearching(true);
      void fetchGroceryItems(1, 8, query, controller.signal)
        .then((page) => {
          if (!controller.signal.aborted) setSuggestions(page.items);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const helperMessage = query.length < 2
    ? 'Type two or more letters to search saved item names.'
    : isSearching
      ? 'Searching your saved items…'
      : suggestions.length > 0
        ? 'Choose a saved name to keep its price history together.'
        : 'No match? This name will create a catalog item.';

  return (
    <>
      <input
        className={inputClassName}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={120}
        placeholder="e.g. Rice"
        list={suggestionsId}
        aria-describedby={helperId}
        required
        disabled={disabled}
      />
      <datalist id={suggestionsId}>
        {suggestions.map((item) => <option key={item.id} value={item.name} />)}
      </datalist>
      <span id={helperId} className="mt-1.5 block text-[10px] font-normal leading-4 text-[#849188]" aria-live="polite">
        {helperMessage}
      </span>
    </>
  );
}

export default function PurchaseForm({ onSubmit }: PurchaseFormProps) {
  const nextItemId = useRef(2);
  const [purchasedOn, setPurchasedOn] = useState(todayAsLocalDate);
  const [storeName, setStoreName] = useState('');
  const [totalPaid, setTotalPaid] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem(1)]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  function updateItem(id: number, changes: Partial<DraftItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  }

  function addItem() {
    if (items.length >= 100) return;
    setItems((current) => [...current, emptyItem(nextItemId.current++)]);
  }

  function removeItem(id: number) {
    setItems((current) => current.length > 1 ? current.filter((item) => item.id !== id) : current);
  }

  function resetForm() {
    setPurchasedOn(todayAsLocalDate());
    setStoreName('');
    setTotalPaid('');
    setItems([emptyItem(nextItemId.current++)]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const totalPaidCentavos = parsePesos(totalPaid);
    if (totalPaidCentavos === null) {
      setErrorMessage(`Enter an amount with up to two decimal places (maximum ₱${maxPesoAmount}).`);
      return;
    }

    const purchaseItems: CreatePurchaseItem[] = [];
    for (const [index, item] of items.entries()) {
      const itemName = item.itemName.trim();
      const unit = item.unit.trim();
      const quantity = Number(item.quantity);
      const amountPaidCentavos = parsePesos(item.amountPaid);

      if (!itemName || !unit || !Number.isFinite(quantity) || quantity <= 0 || amountPaidCentavos === null) {
        setErrorMessage(`Check the name, quantity, unit, and amount for item ${index + 1}.`);
        return;
      }

      if (quantity > 999_999_999.999 || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) >= 1e-7) {
        setErrorMessage(`Item ${index + 1} quantity must use up to three decimal places.`);
        return;
      }

      purchaseItems.push({ itemName, quantity, unit, amountPaidCentavos });
    }

    setIsSaving(true);
    try {
      await onSubmit({
        purchasedOn,
        ...(storeName.trim() ? { storeName: storeName.trim() } : {}),
        totalPaidCentavos,
        items: purchaseItems,
      });
      resetForm();
      setSuccessMessage('Purchase saved. It is now in your history.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save this purchase.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section aria-labelledby="new-purchase-title" className="rounded-[1.75rem] border border-[#dfe6dd] bg-white p-5 shadow-[0_18px_50px_-38px_rgba(23,62,49,0.45)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f8874]">Receipt entry</p>
          <h2 id="new-purchase-title" className="mt-1 text-xl font-semibold tracking-tight text-[#203b30]">Add a purchase</h2>
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClassName}>
            Purchase date
            <input
              className={inputClassName}
              type="date"
              value={purchasedOn}
              onChange={(event) => setPurchasedOn(event.target.value)}
              required
              disabled={isSaving}
            />
          </label>
          <label className={labelClassName}>
            Store <span className="font-normal text-[#849188]">· optional</span>
            <input
              className={inputClassName}
              type="text"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              maxLength={120}
              placeholder="Where did you shop?"
              disabled={isSaving}
            />
          </label>
        </div>

        <label className={labelClassName}>
          Receipt total
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#748378]">₱</span>
            <input
              className={`${inputClassName} pl-8`}
              type="number"
              min="0"
              max={maxPesoAmount}
              step="0.01"
              inputMode="decimal"
              value={totalPaid}
              onChange={(event) => setTotalPaid(event.target.value)}
              placeholder="0.00"
              required
              disabled={isSaving}
            />
          </div>
          <span className="mt-1.5 block text-[11px] font-normal text-[#849188]">The receipt total is the amount used for spending totals.</span>
        </label>

        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#30483a]">Receipt items</h3>
              <p className="mt-1 text-[11px] text-[#849188]">Line amounts help build item cost history.</p>
            </div>
            <button
              className="rounded-lg border border-[#d8e2d6] px-3 py-2 text-xs font-semibold text-[#42684c] transition hover:bg-[#f2f7ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#47765d] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={addItem}
              disabled={isSaving || items.length >= 100}
            >
              + Add item
            </button>
          </div>

          <datalist id="purchase-units">
            <option value="g" />
            <option value="kg" />
            <option value="ml" />
            <option value="l" />
            <option value="item" />
            <option value="pack" />
          </datalist>

          <div className="mt-3 space-y-3">
            {items.map((item, index) => (
              <fieldset key={item.id} className="rounded-2xl border border-[#e5eae2] bg-[#fafbf8] p-3.5 sm:p-4">
                <legend className="sr-only">Receipt item {index + 1}</legend>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8a978d]">Item {String(index + 1).padStart(2, '0')}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-[#8b5c4e] hover:bg-[#f8ebe6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9c5b49]"
                      onClick={() => removeItem(item.id)}
                      disabled={isSaving}
                      aria-label={`Remove item ${index + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className={labelClassName}>
                    Food name
                    <CatalogNameInput
                      itemId={item.id}
                      value={item.itemName}
                      onChange={(itemName) => updateItem(item.id, { itemName })}
                      disabled={isSaving}
                    />
                  </label>
                  <label className={labelClassName}>
                    Line amount
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#748378]">₱</span>
                      <input
                        className={`${inputClassName} pl-8`}
                        type="number"
                        min="0"
                        max={maxPesoAmount}
                        step="0.01"
                        inputMode="decimal"
                        value={item.amountPaid}
                        onChange={(event) => updateItem(item.id, { amountPaid: event.target.value })}
                        placeholder="0.00"
                        required
                        disabled={isSaving}
                      />
                    </div>
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <label className={labelClassName}>
                    Quantity
                    <input
                      className={inputClassName}
                      type="number"
                      min="0.001"
                      max="999999999.999"
                      step="0.001"
                      value={item.quantity}
                      onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                      required
                      disabled={isSaving}
                    />
                  </label>
                  <label className={labelClassName}>
                    Unit
                    <input
                      className={inputClassName}
                      type="text"
                      list="purchase-units"
                      value={item.unit}
                      onChange={(event) => updateItem(item.id, { unit: event.target.value })}
                      maxLength={32}
                      placeholder="kg, item, pack…"
                      required
                      disabled={isSaving}
                    />
                  </label>
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        {errorMessage && (
          <p className="rounded-xl border border-[#f1d7cf] bg-[#fff7f4] px-3.5 py-3 text-sm text-[#8c4538]" role="alert">
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="rounded-xl border border-[#cfe5d0] bg-[#f2faf0] px-3.5 py-3 text-sm text-[#356445]" role="status">
            {successMessage}
          </p>
        )}

        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d503b] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#17412f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d503b] disabled:cursor-wait disabled:opacity-70"
          type="submit"
          disabled={isSaving}
        >
          {isSaving ? 'Saving purchase…' : 'Save purchase'}
          {!isSaving && <span aria-hidden="true">↗</span>}
        </button>

        <p className="text-center text-[11px] leading-5 text-[#8a978d]">
          Quantity units are saved as entered. Any receipt difference is shown as unallocated.
        </p>
      </form>
    </section>
  );
}
