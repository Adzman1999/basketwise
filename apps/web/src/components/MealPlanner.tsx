import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowLeftRight, ArrowRight, CalendarDays, Check, ChefHat, Circle, CircleCheck, Clock3, Copy, Filter, ListChecks, Pencil, Plus, ReceiptText, RotateCcw, Search, ShoppingBasket, Trash2, Utensils, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  deleteMealPlan,
  fetchGroceryItemUnitConversions,
  fetchMealPlans,
  fetchPantryStock,
  fetchPantryStockLots,
  fetchRecipes,
  saveGroceryItemUnitConversion,
  saveMealPlan,
  type GroceryItemUnitConversion,
  type MealPlanEntry,
  type MealType,
  type PantryStockItem,
  type PantryStockLot,
  type Recipe,
} from '@/lib/api';
import { philippineDateString } from '@/lib/dates';
import { getPantryCoverage, type ShoppingListItem } from '@/lib/pantryCoverage';
import type { PurchaseDraftLine } from '@/lib/purchaseDraft';
import { findCloseShoppingMatches } from '@/lib/shoppingSearch';

type PlanState =
  | { kind: 'loading' }
  | { kind: 'loaded'; entries: MealPlanEntry[]; recipes: Recipe[] }
  | { kind: 'error'; message: string };

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const mealLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};
const currencyFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const quantityFormatter = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 });

type ShoppingCheckState = {
  weekFrom: string;
  checkedKeys: string[];
};

type PantryComparisonState =
  | { kind: 'idle' | 'loading' }
  | {
      kind: 'loaded';
      stocks: PantryStockItem[];
      lots: PantryStockLot[];
      conversionsByGroceryItemId: Map<string, GroceryItemUnitConversion[]>;
    }
  | { kind: 'error'; message: string };

type ShoppingUnitPrice = {
  unitPriceCentavos: number;
  purchasedOn: string | null;
  storeName: string | null;
};

function dateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function shiftDate(date: Date, amount: number): Date {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  shifted.setDate(shifted.getDate() + amount);
  return shifted;
}

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', { weekday: 'long' }).format(date);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatDateString(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return formatDate(new Date(year, month - 1, day));
}

function HighlightedShoppingName({ name, query }: { name: string; query: string }) {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const matchIndex = name.toLowerCase().indexOf(normalizedQuery.toLowerCase());
  if (!normalizedQuery || matchIndex < 0) return <>{name}</>;

  return (
    <>
      {name.slice(0, matchIndex)}
      <mark className="rounded bg-primary/20 px-0.5 text-foreground">
        {name.slice(matchIndex, matchIndex + normalizedQuery.length)}
      </mark>
      {name.slice(matchIndex + normalizedQuery.length)}
    </>
  );
}

async function fetchAllRecipes(signal: AbortSignal): Promise<Recipe[]> {
  const recipes: Recipe[] = [];
  let page = 1;
  let total = 0;
  do {
    const result = await fetchRecipes(page, 100, '', null, signal);
    recipes.push(...result.items);
    total = result.total;
    page += 1;
  } while (recipes.length < total);
  return recipes;
}

async function fetchAllPantryStock(signal: AbortSignal): Promise<PantryStockItem[]> {
  const items: PantryStockItem[] = [];
  let page = 1;
  let total = 0;
  do {
    const result = await fetchPantryStock(page, 100, '', '', signal);
    items.push(...result.items);
    total = result.total;
    page += 1;
  } while (items.length < total);
  return items;
}

async function fetchAllPantryLots(search: string, signal: AbortSignal): Promise<PantryStockLot[]> {
  const items: PantryStockLot[] = [];
  let page = 1;
  let total = 0;
  do {
    const result = await fetchPantryStockLots(page, 100, search, signal);
    items.push(...result.items);
    total = result.total;
    page += 1;
  } while (items.length < total);
  return items;
}

async function fetchPantryComparisonData(
  shoppingItems: ShoppingListItem[],
  signal: AbortSignal,
): Promise<Extract<PantryComparisonState, { kind: 'loaded' }>> {
  const stocks = await fetchAllPantryStock(signal);
  const groceryItemIds = new Set(shoppingItems.map((item) => item.groceryItemId));
  const matchingStocks = stocks.filter((stock) => groceryItemIds.has(stock.groceryItemId));
  const searches = Array.from(new Set(matchingStocks.map((stock) => stock.itemName)));
  const conversionItemIds = Array.from(new Set(matchingStocks.map((stock) => stock.groceryItemId)));
  const [lotPages, conversionPages] = await Promise.all([
    Promise.all(searches.map((search) => fetchAllPantryLots(search, signal))),
    Promise.all(conversionItemIds.map(async (groceryItemId) => {
      const result = await fetchGroceryItemUnitConversions(groceryItemId, signal);
      return [groceryItemId, result.items] as const;
    })),
  ]);
  const matchingStockIds = new Set(matchingStocks.map((stock) => stock.id));
  const lots = lotPages.flat().filter((lot) => matchingStockIds.has(lot.pantryStockId));

  return {
    kind: 'loaded',
    stocks: matchingStocks,
    lots,
    conversionsByGroceryItemId: new Map(conversionPages),
  };
}

function buildShoppingList(entries: MealPlanEntry[], recipesById: Map<string, Recipe>): ShoppingListItem[] {
  const items = new Map<string, ShoppingListItem>();
  for (const entry of entries) {
    const recipe = recipesById.get(entry.recipeId);
    if (!recipe) continue;
    const scale = entry.servings / recipe.servings;
    for (const ingredient of recipe.ingredients) {
      const key = `${ingredient.groceryItemId}:${ingredient.unitId}`;
      const item = items.get(key) ?? {
        groceryItemId: ingredient.groceryItemId,
        itemName: ingredient.itemName,
        unitId: ingredient.unitId,
        unit: ingredient.unit,
        quantity: 0,
        plannedMealCount: 0,
      };
      item.quantity += ingredient.quantity * scale;
      item.plannedMealCount += 1;
      items.set(key, item);
    }
  }

  return Array.from(items.values()).sort((left, right) => (
    left.itemName.localeCompare(right.itemName) || left.unit.localeCompare(right.unit)
  ));
}

function shoppingCheckStorageKey(weekFrom: string): string {
  return `basketwise:shopping-checks:${weekFrom}`;
}

function loadShoppingChecks(weekFrom: string): string[] {
  try {
    const raw = window.localStorage.getItem(shoppingCheckStorageKey(weekFrom));
    if (!raw) return [];
    const values: unknown = JSON.parse(raw);
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function saveShoppingChecks(weekFrom: string, checkedKeys: string[]): void {
  try {
    window.localStorage.setItem(shoppingCheckStorageKey(weekFrom), JSON.stringify(checkedKeys));
  } catch {
    // Keep checklist interaction usable if browser storage is unavailable.
  }
}

function MealPlanEditor({
  entry,
  initialDate,
  initialMealType,
  recipes,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: MealPlanEntry | null;
  initialDate: string;
  initialMealType: MealType;
  recipes: Recipe[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [recipeId, setRecipeId] = useState(entry?.recipeId ?? '');
  const [plannedOn, setPlannedOn] = useState(entry?.plannedOn ?? initialDate);
  const [mealType, setMealType] = useState<MealType>(entry?.mealType ?? initialMealType);
  const [servings, setServings] = useState(String(entry?.servings ?? 2));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const parsedServings = Number(servings);
    if (!recipeId) {
      setError('Choose a saved recipe.');
      return;
    }
    if (!Number.isInteger(parsedServings) || parsedServings < 1 || parsedServings > 1000) {
      setError('Enter a whole number of servings from 1 to 1,000.');
      return;
    }

    setIsSaving(true);
    try {
      await saveMealPlan(entry?.id ?? null, { recipeId, plannedOn, mealType, servings: parsedServings });
      onSaved();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save this meal plan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setError('');
    setIsDeleting(true);
    try {
      await deleteMealPlan(entry.id);
      onDeleted();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not remove this planned meal.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && !isDeleting && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit planned meal' : 'Add a planned meal'}</DialogTitle>
          <DialogDescription>Choose a saved recipe and servings. This plan shows an estimate and does not change pantry stock.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Label htmlFor="meal-plan-date" className="grid gap-2 text-sm font-medium">
              Date
              <Input id="meal-plan-date" type="date" value={plannedOn} onChange={(event) => setPlannedOn(event.target.value)} required disabled={isSaving || isDeleting} />
            </Label>
            <Label className="grid gap-2 text-sm font-medium">
              Meal
              <Select value={mealType} onValueChange={(value) => setMealType(value as MealType)} disabled={isSaving || isDeleting}>
                <SelectTrigger aria-label="Meal type"><SelectValue /></SelectTrigger>
                <SelectContent>{mealTypes.map((type) => <SelectItem key={type} value={type}>{mealLabels[type]}</SelectItem>)}</SelectContent>
              </Select>
            </Label>
          </div>
          <Label className="grid gap-2 text-sm font-medium">
            Recipe
            <Select
              value={recipeId || 'unselected'}
              onValueChange={(value) => {
                const recipe = recipes.find((candidate) => candidate.id === value);
                setRecipeId(value === 'unselected' ? '' : value);
                if (!entry && recipe) setServings(String(recipe.servings));
              }}
              disabled={isSaving || isDeleting || recipes.length === 0}
            >
              <SelectTrigger aria-label="Choose recipe"><SelectValue placeholder="Choose a saved recipe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unselected">Choose a saved recipe</SelectItem>
                {recipes.map((recipe) => <SelectItem key={recipe.id} value={recipe.id}>{recipe.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end">
            <div className="min-w-0 text-xs leading-5 text-muted-foreground">
              {selectedRecipe
                ? `This recipe's saved yield is ${selectedRecipe.servings} ${selectedRecipe.servings === 1 ? 'serving' : 'servings'}.`
                : 'Select the number of servings you plan to prepare.'}
            </div>
            <Label htmlFor="meal-plan-servings" className="grid gap-2 text-sm font-medium">
              Planned servings
              <Input id="meal-plan-servings" type="number" min="1" max="1000" step="1" inputMode="numeric" value={servings} onChange={(event) => setServings(event.target.value)} required disabled={isSaving || isDeleting} />
            </Label>
          </div>
          {selectedRecipe && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Estimated meal cost</span>
                <span className="font-semibold tabular-nums">
                  {selectedRecipe.costPerServingCentavos === null || !Number.isInteger(Number(servings))
                    ? 'Unavailable'
                    : currencyFormatter.format(selectedRecipe.costPerServingCentavos * Number(servings) / 100)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Based on current receipt prices; it may change after new purchases.</p>
            </div>
          )}
          {error && <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Could not save meal plan</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {!recipes.length && <p className="text-sm text-muted-foreground">Create a recipe first to add it to your meal plan.</p>}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {entry ? (
              <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={isSaving || isDeleting}>
                <Trash2 aria-hidden="true" /> {isDeleting ? 'Removing…' : 'Remove from plan'}
              </Button>
            ) : <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>Cancel</Button>
              <Button type="submit" disabled={isSaving || isDeleting || recipes.length === 0}>{isSaving ? 'Saving…' : entry ? 'Save changes' : 'Add to plan'}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MealPlanner({
  onCreatePurchaseDraft,
  pantryRevision,
}: {
  onCreatePurchaseDraft: (items: PurchaseDraftLine[], onPurchaseSaved: (shoppingItemKeys: string[]) => void) => void;
  pantryRevision: number;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [state, setState] = useState<PlanState>({ kind: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [recipePriceRefreshKey, setRecipePriceRefreshKey] = useState(0);
  const [recipePriceRefreshError, setRecipePriceRefreshError] = useState('');
  const [pantryRefreshKey, setPantryRefreshKey] = useState(0);
  const [pantryComparisonState, setPantryComparisonState] = useState<PantryComparisonState>({ kind: 'idle' });
  const [showOnlyItemsToBuy, setShowOnlyItemsToBuy] = useState(false);
  const [shoppingListCopyStatus, setShoppingListCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [shoppingSearchQuery, setShoppingSearchQuery] = useState('');
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);
  const [newSlot, setNewSlot] = useState<{ date: string; mealType: MealType } | null>(null);
  const [shoppingCheckState, setShoppingCheckState] = useState<ShoppingCheckState>({ weekFrom: '', checkedKeys: [] });
  const [unitConversionTarget, setUnitConversionTarget] = useState<{
    groceryItemId: string;
    itemName: string;
    purchaseUnitId: string;
    purchaseUnit: string;
    recipeUnitId: string;
    recipeUnit: string;
  } | null>(null);
  const [unitConversionRatio, setUnitConversionRatio] = useState('');
  const [unitConversionError, setUnitConversionError] = useState('');
  const [isSavingUnitConversion, setIsSavingUnitConversion] = useState(false);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index)), [weekStart]);
  const weekFrom = dateToIso(weekDates[0]);
  const weekTo = dateToIso(weekDates[6]);
  const today = philippineDateString();

  useEffect(() => {
    setShoppingCheckState({ weekFrom, checkedKeys: loadShoppingChecks(weekFrom) });
    setShoppingListCopyStatus('idle');
    setShoppingSearchQuery('');
  }, [weekFrom]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    void Promise.all([
      fetchMealPlans(weekFrom, weekTo, controller.signal),
      fetchAllRecipes(controller.signal),
    ])
      .then(([plan, recipes]) => {
        if (!controller.signal.aborted) setState({ kind: 'loaded', entries: plan.items, recipes });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load meal planning.' });
      });
    return () => controller.abort();
  }, [weekFrom, weekTo, refreshKey]);

  useEffect(() => {
    if (recipePriceRefreshKey === 0 || state.kind !== 'loaded') return;
    const controller = new AbortController();
    setRecipePriceRefreshError('');
    void fetchAllRecipes(controller.signal)
      .then((recipes) => {
        if (controller.signal.aborted) return;
        setState((current) => current.kind === 'loaded' ? { ...current, recipes } : current);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRecipePriceRefreshError(error instanceof Error ? error.message : 'Price data could not be refreshed.');
      });
    return () => controller.abort();
  }, [recipePriceRefreshKey, state.kind]);

  const entriesBySlot = useMemo(() => {
    const slots = new Map<string, MealPlanEntry>();
    if (state.kind === 'loaded') {
      for (const entry of state.entries) slots.set(`${entry.plannedOn}:${entry.mealType}`, entry);
    }
    return slots;
  }, [state]);

  const recipesById = useMemo(() => new Map(
    state.kind === 'loaded' ? state.recipes.map((recipe) => [recipe.id, recipe] as const) : [],
  ), [state]);

  const plannedEntries = state.kind === 'loaded' ? state.entries : [];
  const shoppingItems = useMemo(() => buildShoppingList(plannedEntries, recipesById), [plannedEntries, recipesById]);

  useEffect(() => {
    if (state.kind !== 'loaded') return;
    if (shoppingItems.length === 0) {
      setPantryComparisonState({ kind: 'loaded', stocks: [], lots: [], conversionsByGroceryItemId: new Map() });
      return;
    }

    const controller = new AbortController();
    setPantryComparisonState({ kind: 'loading' });
    void fetchPantryComparisonData(shoppingItems, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setPantryComparisonState(data);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPantryComparisonState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not compare pantry stock.',
        });
      });
    return () => controller.abort();
  }, [state.kind, shoppingItems, pantryRefreshKey, pantryRevision]);

  const checkedShoppingKeys = new Set(
    shoppingCheckState.weekFrom === weekFrom ? shoppingCheckState.checkedKeys : [],
  );
  const checkedShoppingCount = shoppingItems.filter((item) => checkedShoppingKeys.has(`${item.groceryItemId}:${item.unitId}`)).length;
  const pantryCoverageByKey = useMemo(() => {
    if (pantryComparisonState.kind !== 'loaded') return new Map<string, ReturnType<typeof getPantryCoverage>>();
    return new Map(shoppingItems.map((item) => [
      `${item.groceryItemId}:${item.unitId}`,
      getPantryCoverage(item, pantryComparisonState, today, weekTo),
    ]));
  }, [pantryComparisonState, shoppingItems, today, weekTo]);
  const shoppingItemsNeedingPurchase = pantryComparisonState.kind === 'loaded'
    ? shoppingItems.filter((item) => (pantryCoverageByKey.get(`${item.groceryItemId}:${item.unitId}`)?.amountToBuy ?? 0) > 0)
    : shoppingItems;
  const shoppingItemsToBuy = pantryComparisonState.kind === 'loaded'
    ? shoppingItemsNeedingPurchase.filter((item) => !checkedShoppingKeys.has(`${item.groceryItemId}:${item.unitId}`))
    : shoppingItems;
  const shoppingItemsForDisplay = showOnlyItemsToBuy && pantryComparisonState.kind === 'loaded'
    ? shoppingItemsToBuy
    : shoppingItems;
  const normalizedShoppingSearch = shoppingSearchQuery.trim().replace(/\s+/g, ' ');
  const matchingShoppingItems = normalizedShoppingSearch
    ? shoppingItems.filter((item) => item.itemName.toLowerCase().includes(normalizedShoppingSearch.toLowerCase()))
    : shoppingItems;
  const visibleShoppingItems = normalizedShoppingSearch
    ? shoppingItemsForDisplay.filter((item) => item.itemName.toLowerCase().includes(normalizedShoppingSearch.toLowerCase()))
    : shoppingItemsForDisplay;
  const searchMatchesOutsideNeedToBuy = showOnlyItemsToBuy
    && pantryComparisonState.kind === 'loaded'
    && matchingShoppingItems.length > 0
    && visibleShoppingItems.length === 0;
  const closeShoppingMatches = normalizedShoppingSearch && visibleShoppingItems.length === 0 && !searchMatchesOutsideNeedToBuy
    ? findCloseShoppingMatches(shoppingItemsForDisplay, normalizedShoppingSearch)
    : [];
  const shoppingUnitPrices = useMemo(() => {
    const prices = new Map<string, ShoppingUnitPrice>();
    for (const entry of plannedEntries) {
      const recipe = recipesById.get(entry.recipeId);
      for (const ingredient of recipe?.ingredients ?? []) {
        if (ingredient.unitPriceCentavos === null) continue;
        const key = `${ingredient.groceryItemId}:${ingredient.unitId}`;
        const current = prices.get(key);
        if (!current || (ingredient.pricePurchasedOn ?? '') > (current.purchasedOn ?? '')) {
          prices.set(key, {
            unitPriceCentavos: ingredient.unitPriceCentavos,
            purchasedOn: ingredient.pricePurchasedOn,
            storeName: ingredient.priceStoreName,
          });
        }
      }
    }
    return prices;
  }, [plannedEntries, recipesById]);
  const shoppingEstimate = useMemo(() => {
    if (pantryComparisonState.kind !== 'loaded' || shoppingItemsToBuy.length === 0) return null;
    let totalCentavos = 0;
    let pricedItemCount = 0;
    let unpricedItemCount = 0;
    let unconvertedItemCount = 0;
    for (const item of shoppingItemsToBuy) {
      const itemKey = `${item.groceryItemId}:${item.unitId}`;
      const coverage = pantryCoverageByKey.get(itemKey);
      if (!coverage || coverage.amountToBuy <= 0) continue;
      if (coverage.unconvertedStockFound) unconvertedItemCount += 1;
      const price = shoppingUnitPrices.get(itemKey);
      if (!price) {
        unpricedItemCount += 1;
        continue;
      }
      pricedItemCount += 1;
      totalCentavos += Math.round(coverage.amountToBuy * price.unitPriceCentavos);
    }
    return { totalCentavos, pricedItemCount, unpricedItemCount, unconvertedItemCount };
  }, [pantryComparisonState.kind, pantryCoverageByKey, shoppingItemsToBuy, shoppingUnitPrices]);

  useEffect(() => {
    if (state.kind !== 'loaded' || shoppingCheckState.weekFrom !== weekFrom) return;
    const validKeys = new Set(shoppingItems.map((item) => `${item.groceryItemId}:${item.unitId}`));
    const checkedKeys = shoppingCheckState.checkedKeys.filter((key) => validKeys.has(key));
    if (checkedKeys.length !== shoppingCheckState.checkedKeys.length) {
      setShoppingCheckState({ weekFrom, checkedKeys });
      return;
    }
    saveShoppingChecks(weekFrom, checkedKeys);
  }, [state.kind, weekFrom, shoppingItems, shoppingCheckState]);
  const estimatedCostCentavos = plannedEntries.reduce((total, entry) => {
    const recipe = recipesById.get(entry.recipeId);
    return total + (recipe?.costPerServingCentavos === null || recipe?.costPerServingCentavos === undefined
      ? 0
      : recipe.costPerServingCentavos * entry.servings);
  }, 0);
  const fullyPricedCount = plannedEntries.filter((entry) => {
    const costPerServing = recipesById.get(entry.recipeId)?.costPerServingCentavos;
    return costPerServing !== null && costPerServing !== undefined;
  }).length;
  const weekLabel = `${new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(weekDates[0])} – ${formatDate(weekDates[6])}`;

  function closeEditor() {
    setEditingEntry(null);
    setNewSlot(null);
  }

  function refreshPlan() {
    closeEditor();
    setShoppingListCopyStatus('idle');
    setRefreshKey((current) => current + 1);
  }

  function toggleShoppingItem(key: string) {
    setShoppingListCopyStatus('idle');
    setShoppingCheckState((current) => {
      const checkedKeys = new Set(current.weekFrom === weekFrom ? current.checkedKeys : []);
      if (checkedKeys.has(key)) checkedKeys.delete(key);
      else checkedKeys.add(key);
      return { weekFrom, checkedKeys: Array.from(checkedKeys) };
    });
  }

  function clearShoppingChecks() {
    setShoppingListCopyStatus('idle');
    setShoppingCheckState({ weekFrom, checkedKeys: [] });
  }

  function retryPantryComparison() {
    setPantryRefreshKey((current) => current + 1);
  }

  function openUnitConversion(item: ShoppingListItem, stockUnit: { unitId: string; unit: string }) {
    setUnitConversionTarget({
      groceryItemId: item.groceryItemId,
      itemName: item.itemName,
      purchaseUnitId: stockUnit.unitId,
      purchaseUnit: stockUnit.unit,
      recipeUnitId: item.unitId,
      recipeUnit: item.unit,
    });
    setUnitConversionRatio('');
    setUnitConversionError('');
  }

  function closeUnitConversion() {
    if (isSavingUnitConversion) return;
    setUnitConversionTarget(null);
    setUnitConversionRatio('');
    setUnitConversionError('');
  }

  async function saveUnitConversion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unitConversionTarget) return;

    const ratio = Number(unitConversionRatio);
    if (!unitConversionRatio.trim() || !Number.isFinite(ratio) || ratio <= 0 || ratio > 999_999_999.999999999
      || Math.abs(ratio * 1_000_000_000 - Math.round(ratio * 1_000_000_000)) >= 0.0001) {
      setUnitConversionError('Enter a positive amount with up to 9 decimal places.');
      return;
    }

    setIsSavingUnitConversion(true);
    setUnitConversionError('');
    try {
      await saveGroceryItemUnitConversion(unitConversionTarget.groceryItemId, {
        purchaseUnitId: unitConversionTarget.purchaseUnitId,
        recipeUnitId: unitConversionTarget.recipeUnitId,
        recipeUnitsPerPurchaseUnit: ratio,
      });
      setUnitConversionTarget(null);
      setUnitConversionRatio('');
      setShoppingListCopyStatus('idle');
      setPantryRefreshKey((current) => current + 1);
      setRecipePriceRefreshKey((current) => current + 1);
    } catch (caughtError) {
      setUnitConversionError(caughtError instanceof Error ? caughtError.message : 'Could not save this conversion.');
    } finally {
      setIsSavingUnitConversion(false);
    }
  }

  function startPurchaseDraft() {
    if (pantryComparisonState.kind !== 'loaded') return;
    const items = shoppingItemsToBuy.flatMap((item) => {
      const coverage = pantryCoverageByKey.get(`${item.groceryItemId}:${item.unitId}`);
      if (!coverage || coverage.amountToBuy <= 0) return [];
      return [{
        shoppingItemKey: `${item.groceryItemId}:${item.unitId}`,
        itemName: item.itemName,
        quantity: coverage.amountToBuy,
        unit: item.unit,
        needsUnitReview: coverage.unconvertedStockFound,
      }];
    });
    if (items.length > 0) onCreatePurchaseDraft(items, markShoppingItemsPickedUp);
  }

  function markShoppingItemsPickedUp(keys: string[]) {
    if (keys.length === 0) return;
    setShoppingListCopyStatus('idle');
    setShoppingCheckState((current) => {
      const checkedKeys = new Set(current.weekFrom === weekFrom ? current.checkedKeys : []);
      keys.forEach((key) => checkedKeys.add(key));
      return { weekFrom, checkedKeys: Array.from(checkedKeys) };
    });
  }

  async function copyShoppingList() {
    if (pantryComparisonState.kind !== 'loaded') return;
    const itemLines = shoppingItemsToBuy.flatMap((item) => {
      const itemKey = `${item.groceryItemId}:${item.unitId}`;
      const coverage = pantryCoverageByKey.get(itemKey);
      if (!coverage || coverage.amountToBuy <= 0) return [];
      const price = shoppingUnitPrices.get(itemKey);
      const amountLabel = coverage.unconvertedStockFound ? 'Up to ' : '';
      const costLabel = price
        ? ` — est. ${currencyFormatter.format(Math.round(coverage.amountToBuy * price.unitPriceCentavos) / 100)}`
        : ' — price unavailable';
      return [`- ${item.itemName}: ${amountLabel}${quantityFormatter.format(coverage.amountToBuy)} ${item.unit}${costLabel}`];
    });
    if (itemLines.length === 0) return;

    const content = [
      `Basketwise shopping list · ${formatDate(weekDates[0])} – ${formatDate(weekDates[6])}`,
      '',
      ...itemLines,
      ...(shoppingEstimate && shoppingEstimate.pricedItemCount > 0
        ? ['', `Estimated total for priced items: ${currencyFormatter.format(shoppingEstimate.totalCentavos / 100)}`]
        : []),
      ...(shoppingEstimate && shoppingEstimate.unconvertedItemCount > 0
        ? ['Some quantities are upper estimates because pantry units still need conversion.']
        : []),
      ...(shoppingEstimate && shoppingEstimate.unpricedItemCount > 0
        ? ['Some items do not have a compatible recorded price.']
        : []),
    ].join('\n');

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.');
      await navigator.clipboard.writeText(content);
      setShoppingListCopyStatus('copied');
    } catch {
      setShoppingListCopyStatus('error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <Badge variant="secondary" className="w-fit gap-1.5"><CalendarDays aria-hidden="true" className="size-4" /> Meal planning</Badge>
          <h2 className="text-2xl font-semibold tracking-tight">Plan your meals</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Schedule saved recipes, review estimated costs, and build a shopping list for the week.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Previous week" title="Previous week" onClick={() => setWeekStart((current) => shiftDate(current, -7))}><ArrowLeft aria-hidden="true" /></Button>
          <Button type="button" variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</Button>
          <Button type="button" variant="outline" size="icon" aria-label="Next week" title="Next week" onClick={() => setWeekStart((current) => shiftDate(current, 7))}><ArrowRight aria-hidden="true" /></Button>
        </div>
      </div>

      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 space-y-0 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base"><CalendarDays aria-hidden="true" className="size-4 text-primary" /> Week of {weekLabel}</CardTitle>
            <CardDescription>Plan recipes and servings for the week, then review the combined ingredients.</CardDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Badge variant="outline" className="gap-1.5"><Utensils aria-hidden="true" className="size-3.5" /> {plannedEntries.length} planned</Badge>
            <Badge variant="secondary" className="tabular-nums">{currencyFormatter.format(estimatedCostCentavos / 100)} estimated</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-4">
          {state.kind === 'loading' && (
            <div className="space-y-3" role="status" aria-label="Loading meal plan">
              {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36" />)}
            </div>
          )}
          {state.kind === 'error' && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Meal plan could not load</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{state.message}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setRefreshKey((current) => current + 1)}>Try again</Button>
              </AlertDescription>
            </Alert>
          )}
          {state.kind === 'loaded' && state.recipes.length === 0 && (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
              <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><ChefHat aria-hidden="true" className="size-5" /></span>
              <p className="text-sm font-medium">Add a recipe before planning meals</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Your saved recipes will appear here with their current cost estimates.</p>
              <Button asChild variant="outline" className="mt-4"><a href="#recipes">Browse recipes</a></Button>
            </div>
          )}
          {state.kind === 'loaded' && state.recipes.length > 0 && (
            <Tabs defaultValue="week" className="space-y-3">
              <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
                <TabsTrigger value="week" className="gap-2"><CalendarDays aria-hidden="true" className="size-4" /> Week plan</TabsTrigger>
                <TabsTrigger value="shopping" className="gap-2"><ShoppingBasket aria-hidden="true" className="size-4" /> Shopping list{shoppingItems.length > 0 && <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-secondary px-1.5 text-[10px] font-semibold text-secondary-foreground">{shoppingItems.length}</span>}</TabsTrigger>
              </TabsList>
              <TabsContent value="week" className="mt-0 space-y-3">
                {weekDates.map((date) => {
                  const dateKey = dateToIso(date);
                  const isToday = dateKey === today;
                  return (
                    <section key={dateKey} className={`rounded-lg border p-3 sm:p-4 ${isToday ? 'border-primary/40 bg-primary/[0.025]' : 'bg-card'}`} aria-label={`${formatDay(date)}, ${formatDate(date)}`}>
                      <div className="mb-3 flex items-center gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold">{formatDay(date)}</h3>
                          <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
                        </div>
                        {isToday && <Badge variant="secondary" className="ml-auto">Today</Badge>}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {mealTypes.map((mealType) => {
                          const entry = entriesBySlot.get(`${dateKey}:${mealType}`);
                          const recipe = entry ? recipesById.get(entry.recipeId) : undefined;
                          return (
                            <div key={mealType} className="min-w-0 rounded-md border bg-background p-2.5">
                              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" />{mealLabels[mealType]}</div>
                              {entry && recipe ? (
                                <button
                                  type="button"
                                  className="group flex min-h-[4.35rem] w-full min-w-0 items-start justify-between gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  onClick={() => setEditingEntry(entry)}
                                  aria-label={`Edit ${mealLabels[mealType]}: ${recipe.name}`}
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium group-hover:text-primary">{recipe.name}</span>
                                    <span className="mt-1 block text-xs text-muted-foreground">{entry.servings} {entry.servings === 1 ? 'serving' : 'servings'}</span>
                                    <span className="mt-1 block truncate text-xs font-medium tabular-nums text-foreground/80">
                                      {recipe.costPerServingCentavos === null
                                        ? 'Cost unavailable'
                                        : currencyFormatter.format(recipe.costPerServingCentavos * entry.servings / 100)}
                                    </span>
                                  </span>
                                  <Pencil aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                                </button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-[4.35rem] w-full justify-start px-2 text-xs text-muted-foreground"
                                  onClick={() => setNewSlot({ date: dateKey, mealType })}
                                >
                                  <Plus aria-hidden="true" className="size-4" /> Add recipe
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </TabsContent>
              <TabsContent value="shopping" className="mt-0">
                {shoppingItems.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
                    <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><ShoppingBasket aria-hidden="true" className="size-5" /></span>
                    <p className="text-sm font-medium">Plan meals to build your shopping list</p>
                    <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Ingredients from the recipes planned for this week will appear here.</p>
                  </div>
                ) : (
                  <Card className="shadow-none">
                    <CardHeader className="flex flex-col gap-2 space-y-0 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base"><ListChecks aria-hidden="true" className="size-4 text-primary" /> Ingredients for this week</CardTitle>
                        <CardDescription>Quantities scale to planned servings. Unexpired pantry stock with a matching or saved unit conversion is subtracted; checklist progress is saved per week in this browser.</CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {pantryComparisonState.kind === 'loaded' && shoppingItemsToBuy.length > 0 && (
                          <>
                            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void copyShoppingList()}>
                              {shoppingListCopyStatus === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                              {shoppingListCopyStatus === 'copied' ? 'Copied' : 'Copy list'}
                            </Button>
                            <Button type="button" size="sm" className="h-8" onClick={startPurchaseDraft}>
                              <ReceiptText aria-hidden="true" /> Start purchase
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          variant={showOnlyItemsToBuy ? 'secondary' : 'outline'}
                          size="sm"
                          className="h-8"
                          aria-label="Show only items still needed"
                          aria-pressed={showOnlyItemsToBuy}
                          disabled={pantryComparisonState.kind !== 'loaded'}
                          onClick={() => setShowOnlyItemsToBuy((current) => !current)}
                        >
                          <Filter aria-hidden="true" />
                          Need to buy
                          {pantryComparisonState.kind === 'loaded' && (
                            <span className="ml-1 tabular-nums">{shoppingItemsToBuy.length}</span>
                          )}
                        </Button>
                        <Badge variant="secondary" className="w-fit tabular-nums">{checkedShoppingCount} of {shoppingItems.length} picked up</Badge>
                        {checkedShoppingCount > 0 && (
                          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={clearShoppingChecks}>
                            <RotateCcw aria-hidden="true" /> Clear checked
                          </Button>
                        )}
                        {shoppingListCopyStatus !== 'idle' && (
                          <span className={`text-xs ${shoppingListCopyStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} role={shoppingListCopyStatus === 'error' ? 'alert' : 'status'} aria-live="polite">
                            {shoppingListCopyStatus === 'copied' ? 'Shopping list copied.' : 'Could not copy the list. Check browser clipboard permissions.'}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    {shoppingEstimate && (
                      <div className="flex flex-col gap-1 border-y bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Estimated cost to buy</p>
                          <p className="text-xs text-muted-foreground">Based on latest compatible prices for items not marked picked up.</p>
                          {recipePriceRefreshError && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-destructive" role="alert">
                              <span>Price data could not refresh. {recipePriceRefreshError}</span>
                              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setRecipePriceRefreshKey((current) => current + 1)}>Try again</Button>
                            </div>
                          )}
                          {(shoppingEstimate.unpricedItemCount > 0 || shoppingEstimate.unconvertedItemCount > 0) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {shoppingEstimate.unpricedItemCount > 0 && `${shoppingEstimate.unpricedItemCount} ${shoppingEstimate.unpricedItemCount === 1 ? 'item has' : 'items have'} no compatible price`}
                              {shoppingEstimate.unpricedItemCount > 0 && shoppingEstimate.unconvertedItemCount > 0 ? ' · ' : ''}
                              {shoppingEstimate.unconvertedItemCount > 0 && `${shoppingEstimate.unconvertedItemCount} amount${shoppingEstimate.unconvertedItemCount === 1 ? '' : 's'} may be overstated until pantry units are converted`}
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 text-lg font-semibold tabular-nums sm:text-right">
                          {shoppingEstimate.pricedItemCount > 0
                            ? currencyFormatter.format(shoppingEstimate.totalCentavos / 100)
                            : 'Price unavailable'}
                          {shoppingEstimate.unpricedItemCount > 0 && shoppingEstimate.pricedItemCount > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">partial estimate</span>}
                        </p>
                      </div>
                    )}
                    {shoppingItems.length > 8 && (
                      <div className="space-y-1 border-b px-3 py-3 sm:px-4">
                        <div className="relative max-w-md">
                          <Label htmlFor="meal-shopping-search" className="sr-only">Search shopping list</Label>
                          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="meal-shopping-search"
                            type="text"
                            inputMode="search"
                            maxLength={120}
                            value={shoppingSearchQuery}
                            onChange={(event) => setShoppingSearchQuery(event.target.value)}
                            placeholder="Search ingredients"
                            className="h-9 pl-9 pr-10"
                          />
                          {shoppingSearchQuery && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                              aria-label="Clear shopping list search"
                              onClick={() => setShoppingSearchQuery('')}
                            >
                              <X aria-hidden="true" className="size-4" />
                            </Button>
                          )}
                        </div>
                        {normalizedShoppingSearch ? (
                          <p className="text-xs text-muted-foreground" aria-live="polite">
                            Showing {visibleShoppingItems.length} of {shoppingItemsForDisplay.length} items. Copy and purchase actions still use all items that need buying.
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Search only narrows the visible rows.</p>
                        )}
                      </div>
                    )}
                    <CardContent className="p-0">
                      {pantryComparisonState.kind === 'error' && (
                        <Alert variant="destructive" className="m-3 sm:m-4">
                          <AlertCircle aria-hidden="true" />
                          <AlertTitle>Pantry quantities could not load</AlertTitle>
                          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>{pantryComparisonState.message}</span>
                            <Button type="button" size="sm" variant="outline" onClick={retryPantryComparison}>Try again</Button>
                          </AlertDescription>
                        </Alert>
                      )}
                      {normalizedShoppingSearch && visibleShoppingItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 border-t px-5 py-10 text-center">
                          <p className="text-sm font-medium">
                            {searchMatchesOutsideNeedToBuy
                              ? `“${normalizedShoppingSearch}” has no items left to buy`
                              : `No ingredients match “${normalizedShoppingSearch}”`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {searchMatchesOutsideNeedToBuy
                              ? 'Show all ingredients to see matches that are already covered or picked up.'
                              : closeShoppingMatches.length > 0
                                ? 'Closest matches:'
                                : 'Try another item name or clear the search.'}
                          </p>
                          {closeShoppingMatches.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-2">
                              {closeShoppingMatches.map((match) => (
                                <Button
                                  key={`${match.item.groceryItemId}:${match.item.unitId}`}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShoppingSearchQuery(match.item.itemName)}
                                >
                                  <HighlightedShoppingName name={match.item.itemName} query={match.matchedPart} />
                                </Button>
                              ))}
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => searchMatchesOutsideNeedToBuy ? setShowOnlyItemsToBuy(false) : setShoppingSearchQuery('')}
                          >
                            {searchMatchesOutsideNeedToBuy ? 'Show all ingredients' : 'Clear search'}
                          </Button>
                        </div>
                      ) : showOnlyItemsToBuy && pantryComparisonState.kind === 'loaded' && visibleShoppingItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 border-t px-5 py-10 text-center">
                          <p className="text-sm font-medium">
                            {shoppingItemsNeedingPurchase.length > 0
                              ? 'You marked the remaining items picked up'
                              : 'Your pantry covers this week’s list'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {shoppingItemsNeedingPurchase.length > 0
                              ? 'Uncheck an item in the full list if you still need to buy it.'
                              : 'No additional quantities are needed for the planned meals.'}
                          </p>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setShowOnlyItemsToBuy(false)}>Show all ingredients</Button>
                        </div>
                      ) : (
                        <ul className="divide-y border-t">
                        {visibleShoppingItems.map((item) => {
                          const itemKey = `${item.groceryItemId}:${item.unitId}`;
                          const isChecked = checkedShoppingKeys.has(itemKey);
                          const coverage = pantryComparisonState.kind === 'loaded'
                            ? pantryCoverageByKey.get(itemKey) ?? null
                            : null;
                          const unitPrice = shoppingUnitPrices.get(itemKey);
                          const estimatedLineCost = coverage && unitPrice && coverage.amountToBuy > 0 && !isChecked
                            ? Math.round(coverage.amountToBuy * unitPrice.unitPriceCentavos)
                            : null;
                          return (
                            <li key={itemKey} className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0"
                                aria-label={`Mark ${item.itemName} as ${isChecked ? 'not picked up' : 'picked up'}`}
                                aria-pressed={isChecked}
                                onClick={() => toggleShoppingItem(itemKey)}
                              >
                                {isChecked
                                  ? <CircleCheck aria-hidden="true" className="size-5 text-primary" />
                                  : <Circle aria-hidden="true" className="size-5 text-muted-foreground" />}
                              </Button>
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-sm font-medium ${isChecked ? 'text-muted-foreground line-through' : ''}`}>
                                  <HighlightedShoppingName name={item.itemName} query={normalizedShoppingSearch} />
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{item.plannedMealCount === 1 ? 'Used in 1 planned meal' : `Used in ${item.plannedMealCount} planned meals`}</p>
                                {coverage ? (
                                  <>
                                    <p className="mt-1 text-xs font-medium text-foreground/80">
                                      {isChecked
                                        ? 'Picked up'
                                        : coverage.amountToBuy <= 0
                                          ? 'Covered by pantry'
                                          : coverage.unconvertedStockFound
                                            ? `Up to ${quantityFormatter.format(coverage.amountToBuy)} ${item.unit} may still be needed`
                                            : `Buy ${quantityFormatter.format(coverage.amountToBuy)} ${item.unit}`}
                                      {estimatedLineCost !== null && (
                                        <span
                                          className="ml-1 font-normal text-muted-foreground"
                                          title={`Estimated from the latest compatible price${unitPrice?.storeName ? ` at ${unitPrice.storeName}` : ''}${unitPrice?.purchasedOn ? ` on ${unitPrice.purchasedOn}` : ''}.`}
                                        >
                                          · est. {currencyFormatter.format(estimatedLineCost / 100)}
                                        </span>
                                      )}
                                    </p>
                                    {coverage.comparableOnHand > 0 && (
                                      <p className="text-xs text-muted-foreground">{quantityFormatter.format(coverage.comparableOnHand)} {item.unit} unexpired on hand</p>
                                    )}
                                    {coverage.expiringStock.map((stock) => (
                                      <p key={`${stock.expiresOn}:${stock.unit}`} className="text-xs text-amber-700 dark:text-amber-400">
                                        Use {quantityFormatter.format(stock.quantity)} {stock.unit} by {formatDateString(stock.expiresOn)}
                                      </p>
                                    ))}
                                    {coverage.unconvertedStockFound && (
                                      <div className="mt-1 space-y-1">
                                        <p className="text-xs text-muted-foreground">Some pantry stock uses another unit and is not included in this estimate.</p>
                                        {coverage.unconvertedStockUnits.map((stockUnit) => (
                                          <Button
                                            key={stockUnit.unitId}
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            className="h-auto gap-1 px-0 py-0 text-xs"
                                            onClick={() => openUnitConversion(item, stockUnit)}
                                          >
                                            <ArrowLeftRight aria-hidden="true" className="size-3.5" />
                                            Convert {quantityFormatter.format(stockUnit.quantity)} {stockUnit.unit} to {item.unit}
                                          </Button>
                                        ))}
                                      </div>
                                    )}
                                    {coverage.expiredStockFound && <p className="text-xs text-muted-foreground">Expired stock is excluded from this estimate.</p>}
                                  </>
                                ) : pantryComparisonState.kind === 'loading' || pantryComparisonState.kind === 'idle' ? (
                                  <p className="mt-1 text-xs text-muted-foreground">Checking pantry stock…</p>
                                ) : null}
                              </div>
                              <p className="shrink-0 self-start pt-1 text-right text-sm font-semibold tabular-nums">{quantityFormatter.format(item.quantity)} <span className="font-normal text-muted-foreground">{item.unit}</span></p>
                            </li>
                          );
                        })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {state.kind === 'loaded' && state.recipes.length > 0 && plannedEntries.length > 0 && fullyPricedCount < plannedEntries.length && (
        <p className="text-xs leading-5 text-muted-foreground">{plannedEntries.length - fullyPricedCount} planned {plannedEntries.length - fullyPricedCount === 1 ? 'meal has' : 'meals have'} incomplete price data and are not included in the estimate.</p>
      )}

      {state.kind === 'loaded' && (editingEntry || newSlot) && (
        <MealPlanEditor
          key={editingEntry?.id ?? `${newSlot?.date}:${newSlot?.mealType}`}
          entry={editingEntry}
          initialDate={newSlot?.date ?? weekFrom}
          initialMealType={newSlot?.mealType ?? 'dinner'}
          recipes={state.recipes}
          onClose={closeEditor}
          onSaved={refreshPlan}
          onDeleted={refreshPlan}
        />
      )}

      <Dialog
        open={unitConversionTarget !== null}
        onOpenChange={(open) => { if (!open) closeUnitConversion(); }}
      >
        <DialogContent>
          <form onSubmit={(event) => void saveUnitConversion(event)} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Convert pantry units</DialogTitle>
              <DialogDescription>
                For {unitConversionTarget?.itemName}, set how much of the shopping-list unit is in one pantry unit. This saved conversion will be reused for this item.
              </DialogDescription>
            </DialogHeader>
            {unitConversionTarget && (
              <div className="space-y-2">
                <Label htmlFor="pantry-unit-conversion-ratio">Conversion</Label>
                <div className="grid grid-cols-[auto_minmax(5rem,1fr)_auto] items-center gap-2">
                  <span className="text-sm text-muted-foreground">1 {unitConversionTarget.purchaseUnit} =</span>
                  <Input
                    id="pantry-unit-conversion-ratio"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={unitConversionRatio}
                    onChange={(event) => setUnitConversionRatio(event.target.value)}
                    aria-describedby={unitConversionError ? 'pantry-unit-conversion-error' : undefined}
                    autoFocus
                  />
                  <span className="text-sm text-muted-foreground">{unitConversionTarget.recipeUnit}</span>
                </div>
                {unitConversionError && <p id="pantry-unit-conversion-error" role="alert" className="text-sm text-destructive">{unitConversionError}</p>}
              </div>
            )}
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={closeUnitConversion} disabled={isSavingUnitConversion}>Cancel</Button>
              <Button type="submit" disabled={isSavingUnitConversion || !unitConversionTarget}>{isSavingUnitConversion ? 'Saving…' : 'Save conversion'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
