import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UnitInput from '@/components/UnitInput';
import {
  createUnit,
  createStore,
  fetchUnits,
  fetchGroceryItems,
  fetchStores,
  storeCategories,
  storeCategoryLabels,
  type CreatePurchaseItem,
  type CreatePurchaseRequest,
  type GroceryItem,
  type MeasurementUnit,
  type Store,
  type StoreCategory,
} from '../lib/api';

type DraftItem = {
  id: number;
  itemName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type PurchaseFormProps = {
  onSubmit: (purchase: CreatePurchaseRequest) => Promise<void>;
  onCancel: () => void;
};

const maxCentavos = 2_147_483_647;
const maxPesoAmount = (maxCentavos / 100).toFixed(2);
const maxQuantityMilliUnits = 999_999_999_999n;

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

function parseQuantityMilliUnits(value: string): bigint | null {
  const match = value.trim().match(/^(?:(\d+)(?:\.(\d{0,3}))?|\.(\d{1,3}))$/);
  if (!match) return null;

  const wholeUnits = BigInt(match[1] || '0');
  const fractionalMilliUnits = BigInt((match[2] ?? match[3] ?? '').padEnd(3, '0') || '0');
  const quantityMilliUnits = wholeUnits * 1000n + fractionalMilliUnits;
  if (quantityMilliUnits <= 0n || quantityMilliUnits > maxQuantityMilliUnits) return null;
  return quantityMilliUnits;
}

function calculateLineTotalCentavos(unitPriceCentavos: number | null, quantityMilliUnits: bigint | null): bigint | null {
  if (unitPriceCentavos === null || quantityMilliUnits === null) return null;
  const productMilliCentavos = BigInt(unitPriceCentavos) * quantityMilliUnits;
  return (productMilliCentavos + 500n) / 1000n;
}

function lineTotalForItem(item: DraftItem): bigint | null {
  return calculateLineTotalCentavos(parsePesos(item.unitPrice), parseQuantityMilliUnits(item.quantity));
}

function formatPesoAmount(centavos: bigint): string {
  const wholePesos = (centavos / 100n).toLocaleString('en-PH');
  const remainingCentavos = String(centavos % 100n).padStart(2, '0');
  return `${wholePesos}.${remainingCentavos}`;
}

function emptyItem(id: number): DraftItem {
  return { id, itemName: '', quantity: '1', unit: 'item', unitPrice: '' };
}

const inputClassName = 'h-10 w-full min-w-0 rounded-md bg-background text-base sm:text-sm';
const labelClassName = 'grid min-w-0 gap-2 text-sm font-medium';
const noStoreValue = 'none';
const otherStoreValue = 'other-unknown';

function normalizeStoreName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function storeMatchRank(name: string, query: string): number | null {
  const normalizedName = normalizeStoreName(name);
  const normalizedQuery = normalizeStoreName(query);
  if (!normalizedQuery) return 10;
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;

  const words = normalizedName.split(' ');
  if (words.some((word) => word.startsWith(normalizedQuery))) return 3;

  if (normalizedQuery.length < 3) return null;
  const bestDistance = Math.min(...words.map((word) => editDistance(normalizedQuery, word)));
  const allowedDistance = normalizedQuery.length >= 6 ? 2 : 1;
  return bestDistance <= allowedDistance ? 4 + bestDistance : null;
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const normalizedQuery = query.trim();
  const index = name.toLowerCase().indexOf(normalizedQuery.toLowerCase());
  if (!normalizedQuery) return <>{name}</>;

  if (index >= 0) {
    return (
      <>
        {name.slice(0, index)}
        <mark className="rounded bg-primary/20 px-0.5 text-foreground">{name.slice(index, index + normalizedQuery.length)}</mark>
        {name.slice(index + normalizedQuery.length)}
      </>
    );
  }

  const words = name.split(/(\s+)/);
  const closestWord = words
    .filter((word) => word.trim())
    .sort((left, right) => editDistance(normalizedQuery.toLowerCase(), left.toLowerCase()) - editDistance(normalizedQuery.toLowerCase(), right.toLowerCase()))[0];
  if (!closestWord) return <>{name}</>;
  const closestIndex = name.toLowerCase().indexOf(closestWord.toLowerCase());
  return (
    <>
      {name.slice(0, closestIndex)}
      <mark className="rounded bg-primary/20 px-0.5 text-foreground">{name.slice(closestIndex, closestIndex + closestWord.length)}</mark>
      {name.slice(closestIndex + closestWord.length)}
    </>
  );
}

function CatalogNameInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [suggestions, setSuggestions] = useState<GroceryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const query = value.trim();
  const helperId = useId();

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setSuggestions([]);
    setIsSearching(true);
    const timeout = window.setTimeout(() => {
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
      <Command shouldFilter={false} className="h-auto overflow-visible rounded-md bg-transparent">
        <CommandInput
          className="h-full w-auto min-w-0 flex-1 bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0 sm:text-sm"
          wrapperClassName="h-10 rounded-md border border-input bg-background px-3 shadow-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring"
          value={value}
          onValueChange={(nextValue) => {
            onChange(nextValue);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          maxLength={120}
          placeholder="e.g. Rice"
          aria-describedby={helperId}
          required
          disabled={disabled}
        />
        {isOpen && query.length >= 2 && (
          <CommandList className="mt-1 rounded-md border bg-popover shadow-sm">
            {isSearching ? (
              <CommandEmpty>Searching saved grocery items…</CommandEmpty>
            ) : suggestions.length === 0 ? (
              <CommandEmpty>No saved item matches. This name will create a new catalog item.</CommandEmpty>
            ) : (
              <CommandGroup heading="Saved item matches">
                {suggestions.map((item) => (
                  <CommandItem key={item.id} value={item.name} onSelect={() => {
                    onChange(item.name);
                    setIsOpen(false);
                  }}>
                    <span className="min-w-0 flex-1 truncate"><HighlightedName name={item.name} query={query} /></span>
                    <Badge variant={item.name.toLowerCase() === query.toLowerCase() ? 'default' : 'outline'}>
                      {item.name.toLowerCase() === query.toLowerCase() ? 'Exact match' : 'Close match'}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
      <span id={helperId} className="block text-xs font-normal leading-5 text-muted-foreground" aria-live="polite">
        {helperMessage}
      </span>
    </>
  );
}

export default function PurchaseForm({ onSubmit, onCancel }: PurchaseFormProps) {
  const nextItemId = useRef(2);
  const [purchasedOn, setPurchasedOn] = useState(todayAsLocalDate);
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storeLoadError, setStoreLoadError] = useState('');
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitLoadError, setUnitLoadError] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState(noStoreValue);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeSuggestionsOpen, setStoreSuggestionsOpen] = useState(false);
  const [storeEditorOpen, setStoreEditorOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCategory, setNewStoreCategory] = useState<StoreCategory>('supermarket');
  const [storeErrorMessage, setStoreErrorMessage] = useState('');
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([emptyItem(1)]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetchStores(controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setStores(page.items);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStoreLoadError(error instanceof Error ? error.message : 'Could not load saved stores.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setStoresLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchUnits(controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setUnits(page.items);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setUnitLoadError(error instanceof Error ? error.message : 'Could not load saved units.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setUnitsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const selectedStore = stores.find((store) => store.id === selectedStoreId);
  const storeSuggestions = stores
    .map((store) => ({ store, rank: storeMatchRank(store.name, storeSearch) }))
    .filter((entry): entry is { store: Store; rank: number } => entry.rank !== null)
    .sort((left, right) => left.rank - right.rank || left.store.name.localeCompare(right.store.name))
    .slice(0, 8);
  const calculatedTotalCentavos = items.reduce(
    (total, item) => total + (lineTotalForItem(item) ?? 0n),
    0n
  );

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
    setSelectedStoreId(noStoreValue);
    setStoreSearch('');
    setStoreSuggestionsOpen(false);
    setStoreEditorOpen(false);
    setNewStoreName('');
    setNewStoreCategory('supermarket');
    setStoreErrorMessage('');
    setErrorMessage('');
    setSuccessMessage('');
    setItems([emptyItem(nextItemId.current++)]);
  }

  function cancelPurchase() {
    resetForm();
    onCancel();
  }

  async function saveUnit(name: string): Promise<MeasurementUnit> {
    const normalizedName = name.trim().replace(/\s+/g, ' ').toLowerCase();
    const existing = units.find((unit) => unit.name.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedName);
    if (existing) return existing;

    const unit = await createUnit(name);
    setUnits((current) => [...current, unit].sort((left, right) => {
      if (left.isPreset !== right.isPreset) return left.isPreset ? -1 : 1;
      return left.name.localeCompare(right.name);
    }));
    return unit;
  }

  async function saveNewStore() {
    const name = newStoreName.trim().replace(/\s+/g, ' ');
    if (!name) {
      setStoreErrorMessage('Enter a store or shop name.');
      return;
    }

    const existing = stores.find((store) => normalizeStoreName(store.name) === normalizeStoreName(name));
    if (existing) {
      setSelectedStoreId(existing.id);
      setStoreSearch(existing.name);
      setStoreSuggestionsOpen(false);
      setStoreEditorOpen(false);
      setStoreErrorMessage('');
      return;
    }

    setStoreErrorMessage('');
    setIsAddingStore(true);
    try {
      const store = await createStore({ name, category: newStoreCategory });
      setStores((current) => [...current, store].sort((left, right) => left.name.localeCompare(right.name)));
      setSelectedStoreId(store.id);
      setStoreSearch(store.name);
      setStoreSuggestionsOpen(false);
      setNewStoreName('');
      setStoreEditorOpen(false);
    } catch (error) {
      setStoreErrorMessage(error instanceof Error ? error.message : 'Could not save this store or shop.');
    } finally {
      setIsAddingStore(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (storeEditorOpen || isAddingStore) {
      setErrorMessage('Save or cancel the new store before saving this purchase.');
      return;
    }
    if (!selectedStore && selectedStoreId !== otherStoreValue) {
      setErrorMessage('Choose a saved place, add this place, or select Other if you’re unsure.');
      return;
    }

    const purchaseItems: CreatePurchaseItem[] = [];
    for (const [index, item] of items.entries()) {
      const itemName = item.itemName.trim();
      const unit = item.unit.trim();
      const quantity = Number(item.quantity);
      const quantityMilliUnits = parseQuantityMilliUnits(item.quantity);
      const unitPriceCentavos = parsePesos(item.unitPrice);

      if (!itemName || !unit || unitPriceCentavos === null) {
        setErrorMessage(`Check the name, unit, and price per unit for item ${index + 1}.`);
        return;
      }

      if (!Number.isFinite(quantity) || quantityMilliUnits === null) {
        setErrorMessage(`Item ${index + 1} quantity must use up to three decimal places.`);
        return;
      }

      const amountPaidCentavos = calculateLineTotalCentavos(unitPriceCentavos, quantityMilliUnits);
      if (amountPaidCentavos === null || amountPaidCentavos > BigInt(maxCentavos)) {
        setErrorMessage(`The line total for item ${index + 1} cannot exceed ₱${maxPesoAmount}.`);
        return;
      }

      purchaseItems.push({ itemName, quantity, unit, amountPaidCentavos: Number(amountPaidCentavos) });
    }

    const totalPaidCentavos = purchaseItems.reduce((total, item) => total + BigInt(item.amountPaidCentavos), 0n);
    if (totalPaidCentavos > BigInt(maxCentavos)) {
      setErrorMessage(`The receipt items total cannot exceed ₱${maxPesoAmount}.`);
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        purchasedOn,
        storeName: selectedStore?.name ?? 'Other',
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
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-5">
          <div className="grid gap-4 pt-4 sm:grid-cols-2 sm:pt-5">
            <Label className={labelClassName}>
              Purchase date
              <Input className={inputClassName} type="date" value={purchasedOn} onChange={(event) => setPurchasedOn(event.target.value)} required disabled={isSaving} />
            </Label>
            <Label className={labelClassName}>
              Store or shop
              <Command shouldFilter={false} className="relative h-auto w-full min-w-0 self-start items-start overflow-visible rounded-md bg-transparent">
                <CommandInput
                  className="h-full w-0 min-w-0 flex-1 bg-transparent px-0 py-0 text-left text-sm shadow-none focus-visible:ring-0"
                  wrapperClassName="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 shadow-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring"
                  value={storeSearch}
                  onValueChange={(nextValue) => {
                    setStoreSearch(nextValue);
                    setStoreSuggestionsOpen(true);
                    if (nextValue !== selectedStore?.name) setSelectedStoreId(noStoreValue);
                  }}
                  onFocus={() => setStoreSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setStoreSuggestionsOpen(false), 120)}
                  placeholder={storesLoading ? 'Loading saved places…' : 'Search stores and shops'}
                  aria-label="Search stores and shops"
                  aria-required="true"
                  aria-expanded={storeSuggestionsOpen}
                  disabled={isSaving || storesLoading}
                />
                {storeSuggestionsOpen && !storesLoading && (
                  <CommandList className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 w-full rounded-md border bg-popover shadow-lg">
                    {storeSearch.trim() ? (
                      <CommandGroup heading="Saved places">
                        {storeSuggestions.map(({ store, rank }) => (
                          <CommandItem
                            key={store.id}
                            value={`${store.name} ${storeCategoryLabels[store.category]}`}
                            onSelect={() => {
                              setSelectedStoreId(store.id);
                              setStoreSearch(store.name);
                              setStoreSuggestionsOpen(false);
                            }}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium"><HighlightedName name={store.name} query={storeSearch} /></span>
                              <span className="block truncate text-xs text-muted-foreground">{storeCategoryLabels[store.category]}</span>
                            </span>
                            <Badge variant={rank === 0 ? 'default' : 'outline'}>
                              {rank === 0 ? 'Exact match' : rank >= 4 ? 'Close match' : 'Match'}
                            </Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ) : (
                      <CommandGroup heading="Saved places">
                        {storeSuggestions.map(({ store }) => (
                          <CommandItem key={store.id} value={`${store.name} ${storeCategoryLabels[store.category]}`} onSelect={() => {
                            setSelectedStoreId(store.id);
                            setStoreSearch(store.name);
                            setStoreSuggestionsOpen(false);
                          }}>
                            <span className="min-w-0 flex-1 truncate">{store.name}</span>
                            <span className="text-xs text-muted-foreground">{storeCategoryLabels[store.category]}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {!stores.some((store) => normalizeStoreName(store.name) === 'other') && (
                      <CommandItem value="other not sure" onSelect={() => {
                        setSelectedStoreId(otherStoreValue);
                        setStoreSearch('Other');
                        setStoreSuggestionsOpen(false);
                      }}>
                        Other <span className="ml-1 text-xs text-muted-foreground">(not sure)</span>
                      </CommandItem>
                    )}
                    {storeSearch.trim() && !stores.some((store) => normalizeStoreName(store.name) === normalizeStoreName(storeSearch)) && (
                      <CommandItem value={`add ${storeSearch}`} onSelect={() => {
                        setStoreErrorMessage('');
                        setNewStoreName(storeSearch.trim());
                        setStoreEditorOpen(true);
                        setStoreSuggestionsOpen(false);
                      }}>
                        <Plus aria-hidden="true" /> Add “{storeSearch.trim()}” as a new place
                      </CommandItem>
                    )}
                    {storeSearch.trim() && storeSuggestions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No exact or close saved place was found.</div>
                    )}
                  </CommandList>
                )}
              </Command>
              <span className="text-xs font-normal text-muted-foreground">Choose a saved place, add one, or select Other if you’re unsure.</span>
              {storeLoadError && <span className="text-xs font-normal leading-5 text-destructive">{storeLoadError}</span>}
            </Label>
          </div>

          {storeEditorOpen && (
            <fieldset className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <legend className="px-1 text-sm font-medium">Add a store or shop</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Label htmlFor="purchase-new-store-name" className={labelClassName}>
                  Name
                  <Input
                    id="purchase-new-store-name"
                    className={inputClassName}
                    value={newStoreName}
                    onChange={(event) => setNewStoreName(event.target.value)}
                    maxLength={120}
                    placeholder="e.g. Green Market"
                    disabled={isAddingStore || isSaving}
                  />
                </Label>
                <div className="grid min-w-0 gap-2 text-sm font-medium">
                  <Label htmlFor="purchase-new-store-category">Category</Label>
                  <Select
                    value={newStoreCategory}
                    onValueChange={(value) => setNewStoreCategory(value as StoreCategory)}
                    disabled={isAddingStore || isSaving}
                  >
                    <SelectTrigger id="purchase-new-store-category" className={inputClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {storeCategories.map((category) => (
                        <SelectItem key={category} value={category}>{storeCategoryLabels[category]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {storeErrorMessage && (
                <Alert variant="destructive">
                  <AlertTitle>Store could not be added</AlertTitle>
                  <AlertDescription>{storeErrorMessage}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setStoreEditorOpen(false)} disabled={isAddingStore || isSaving}>Cancel</Button>
                <Button type="button" size="sm" onClick={() => void saveNewStore()} disabled={isAddingStore || isSaving || !newStoreName.trim()}>
                  <Plus aria-hidden="true" /> {isAddingStore ? 'Saving…' : 'Save place'}
                </Button>
              </div>
            </fieldset>
          )}

          <div className="space-y-3">
            <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 shadow-sm backdrop-blur sm:-mx-6 sm:px-6">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Receipt items</h3>
                <p className="text-xs text-muted-foreground">Enter the price per unit and quantity for each item.</p>
                {unitLoadError && (
                  <p className="text-xs leading-5 text-destructive">
                    Could not load saved units: {unitLoadError} You can still enter a unit manually; it will be saved with the purchase.
                  </p>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={isSaving || items.length >= 100}>
                <Plus aria-hidden="true" /> Add item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const lineTotalCentavos = lineTotalForItem(item);
                return (
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
                        <CatalogNameInput value={item.itemName} onChange={(itemName) => updateItem(item.id, { itemName })} disabled={isSaving} />
                      </Label>
                      <Label className={labelClassName}>
                        Price per unit
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">₱</span>
                          <Input className={`${inputClassName} pl-8`} type="number" min="0" max={maxPesoAmount} step="0.01" inputMode="decimal" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} placeholder="0.00" required disabled={isSaving} />
                        </div>
                      </Label>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Label className={labelClassName}>
                        Quantity
                        <Input className={inputClassName} type="number" min="0.001" max="999999999.999" step="0.001" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} required disabled={isSaving} />
                      </Label>
                      <Label className={labelClassName}>
                        Unit
                        <UnitInput
                          value={item.unit}
                          units={units}
                          onChange={(unit) => updateItem(item.id, { unit })}
                          onAddUnit={saveUnit}
                          disabled={isSaving || unitsLoading}
                        />
                      </Label>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Line total <span className="text-xs">(quantity × price per unit)</span></span>
                      <output className="shrink-0 font-semibold tabular-nums">
                        {lineTotalCentavos === null ? '—' : `₱${formatPesoAmount(lineTotalCentavos)}`}
                      </output>
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3.5" aria-live="polite">
            <span>
              <span className="block text-sm font-medium">Receipt total</span>
              <span className="block text-xs text-muted-foreground">Sum of each quantity × unit price</span>
            </span>
            <output className="text-lg font-semibold tabular-nums">₱{formatPesoAmount(calculatedTotalCentavos)}</output>
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

          <p className="text-center text-xs leading-5 text-muted-foreground">
            Each line total is quantity × price per unit. The receipt total adds all line totals.
          </p>

      </div>

      <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4">
        <Button className="w-full sm:w-auto" variant="outline" size="lg" type="button" onClick={cancelPurchase} disabled={isSaving || isAddingStore}>
          Cancel
        </Button>
        <Button className="w-full sm:w-auto" size="lg" type="submit" disabled={isSaving || isAddingStore || unitsLoading}>
          <Save aria-hidden="true" />
          {isSaving ? 'Saving purchase…' : 'Save purchase'}
        </Button>
      </div>
    </form>
  );
}
