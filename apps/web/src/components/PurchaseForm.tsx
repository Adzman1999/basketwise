import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const inputClassName = 'mt-1.5 h-10 rounded-lg bg-background text-sm';
const labelClassName = 'grid gap-1.5 text-sm font-medium';

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
      <Input
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
      <span id={helperId} className="block text-xs font-normal leading-5 text-muted-foreground" aria-live="polite">
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
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Label className={labelClassName}>
              Purchase date
              <Input className={inputClassName} type="date" value={purchasedOn} onChange={(event) => setPurchasedOn(event.target.value)} required disabled={isSaving} />
            </Label>
            <Label className={labelClassName}>
              Store <span className="font-normal text-muted-foreground">· optional</span>
              <Input className={inputClassName} type="text" value={storeName} onChange={(event) => setStoreName(event.target.value)} maxLength={120} placeholder="Where did you shop?" disabled={isSaving} />
            </Label>
          </div>

          <Label className={labelClassName}>
            Receipt total
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">₱</span>
              <Input className={`${inputClassName} pl-8`} type="number" min="0" max={maxPesoAmount} step="0.01" inputMode="decimal" value={totalPaid} onChange={(event) => setTotalPaid(event.target.value)} placeholder="0.00" required disabled={isSaving} />
            </div>
            <span className="text-xs font-normal text-muted-foreground">The receipt total is used for spending totals.</span>
          </Label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Receipt items</h3>
                <p className="text-xs text-muted-foreground">Line amounts help build item cost history.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={isSaving || items.length >= 100}>
                <Plus aria-hidden="true" /> Add item
              </Button>
            </div>

            <datalist id="purchase-units">
              <option value="g" />
              <option value="kg" />
              <option value="ml" />
              <option value="l" />
              <option value="item" />
              <option value="pack" />
            </datalist>

            <div className="space-y-3">
              {items.map((item, index) => (
                <fieldset key={item.id} className="min-w-0 rounded-lg border bg-muted/20 p-3.5 sm:p-4">
                  <legend className="sr-only">Receipt item {index + 1}</legend>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline">Item {String(index + 1).padStart(2, '0')}</Badge>
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeItem(item.id)} disabled={isSaving} aria-label={`Remove item ${index + 1}`}>
                        <Trash2 aria-hidden="true" /> Remove
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Label className={labelClassName}>
                      Food name
                      <CatalogNameInput itemId={item.id} value={item.itemName} onChange={(itemName) => updateItem(item.id, { itemName })} disabled={isSaving} />
                    </Label>
                    <Label className={labelClassName}>
                      Line amount
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">₱</span>
                        <Input className={`${inputClassName} pl-8`} type="number" min="0" max={maxPesoAmount} step="0.01" inputMode="decimal" value={item.amountPaid} onChange={(event) => updateItem(item.id, { amountPaid: event.target.value })} placeholder="0.00" required disabled={isSaving} />
                      </div>
                    </Label>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <Label className={labelClassName}>
                      Quantity
                      <Input className={inputClassName} type="number" min="0.001" max="999999999.999" step="0.001" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} required disabled={isSaving} />
                    </Label>
                    <Label className={labelClassName}>
                      Unit
                      <Input className={inputClassName} type="text" list="purchase-units" value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} maxLength={32} placeholder="kg, item, pack…" required disabled={isSaving} />
                    </Label>
                  </div>
                </fieldset>
              ))}
            </div>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertTitle>Purchase could not be saved</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          {successMessage && (
            <Alert className="border-primary/30 bg-primary/5 text-foreground" role="status">
              <CheckCircle2 aria-hidden="true" className="text-primary" />
              <AlertTitle>Purchase saved</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

      </div>

      <div className="sticky bottom-0 z-10 shrink-0 border-t bg-background px-6 py-4">
        <Button className="w-full" size="lg" type="submit" disabled={isSaving}>
            <Save aria-hidden="true" />
            {isSaving ? 'Saving purchase…' : 'Save purchase'}
        </Button>

        <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
          Quantity units are saved as entered. Any receipt difference is shown as unallocated.
        </p>
      </div>
    </form>
  );
}
