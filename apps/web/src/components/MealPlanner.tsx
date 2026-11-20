import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, ChefHat, Circle, CircleCheck, Clock3, Filter, ListChecks, Pencil, Plus, RotateCcw, ShoppingBasket, Trash2, Utensils } from 'lucide-react';
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

export default function MealPlanner() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [state, setState] = useState<PlanState>({ kind: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [pantryRefreshKey, setPantryRefreshKey] = useState(0);
  const [pantryComparisonState, setPantryComparisonState] = useState<PantryComparisonState>({ kind: 'idle' });
  const [showOnlyItemsToBuy, setShowOnlyItemsToBuy] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);
  const [newSlot, setNewSlot] = useState<{ date: string; mealType: MealType } | null>(null);
  const [shoppingCheckState, setShoppingCheckState] = useState<ShoppingCheckState>({ weekFrom: '', checkedKeys: [] });

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index)), [weekStart]);
  const weekFrom = dateToIso(weekDates[0]);
  const weekTo = dateToIso(weekDates[6]);
  const today = philippineDateString();

  useEffect(() => {
    setShoppingCheckState({ weekFrom, checkedKeys: loadShoppingChecks(weekFrom) });
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
  }, [state.kind, shoppingItems, pantryRefreshKey]);

  const checkedShoppingKeys = new Set(
    shoppingCheckState.weekFrom === weekFrom ? shoppingCheckState.checkedKeys : [],
  );
  const checkedShoppingCount = shoppingItems.filter((item) => checkedShoppingKeys.has(`${item.groceryItemId}:${item.unitId}`)).length;
  const pantryCoverageByKey = useMemo(() => {
    if (pantryComparisonState.kind !== 'loaded') return new Map<string, ReturnType<typeof getPantryCoverage>>();
    return new Map(shoppingItems.map((item) => [
      `${item.groceryItemId}:${item.unitId}`,
      getPantryCoverage(item, pantryComparisonState, today),
    ]));
  }, [pantryComparisonState, shoppingItems, today]);
  const shoppingItemsToBuy = pantryComparisonState.kind === 'loaded'
    ? shoppingItems.filter((item) => (pantryCoverageByKey.get(`${item.groceryItemId}:${item.unitId}`)?.amountToBuy ?? 0) > 0)
    : shoppingItems;
  const visibleShoppingItems = showOnlyItemsToBuy && pantryComparisonState.kind === 'loaded'
    ? shoppingItemsToBuy
    : shoppingItems;

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
    setRefreshKey((current) => current + 1);
  }

  function toggleShoppingItem(key: string) {
    setShoppingCheckState((current) => {
      const checkedKeys = new Set(current.weekFrom === weekFrom ? current.checkedKeys : []);
      if (checkedKeys.has(key)) checkedKeys.delete(key);
      else checkedKeys.add(key);
      return { weekFrom, checkedKeys: Array.from(checkedKeys) };
    });
  }

  function clearShoppingChecks() {
    setShoppingCheckState({ weekFrom, checkedKeys: [] });
  }

  function retryPantryComparison() {
    setPantryRefreshKey((current) => current + 1);
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
                      </div>
                    </CardHeader>
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
                      {showOnlyItemsToBuy && pantryComparisonState.kind === 'loaded' && visibleShoppingItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 border-t px-5 py-10 text-center">
                          <p className="text-sm font-medium">Your pantry covers this week’s list</p>
                          <p className="text-sm text-muted-foreground">No additional quantities are needed for the planned meals.</p>
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
                                <p className={`truncate text-sm font-medium ${isChecked ? 'text-muted-foreground line-through' : ''}`}>{item.itemName}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{item.plannedMealCount === 1 ? 'Used in 1 planned meal' : `Used in ${item.plannedMealCount} planned meals`}</p>
                                {coverage ? (
                                  <>
                                    <p className="mt-1 text-xs font-medium text-foreground/80">
                                      {coverage.unconvertedStockFound && coverage.amountToBuy > 0
                                        ? `At least ${quantityFormatter.format(coverage.amountToBuy)} ${item.unit} still needed`
                                        : coverage.amountToBuy > 0
                                          ? `Buy ${quantityFormatter.format(coverage.amountToBuy)} ${item.unit}`
                                          : 'Covered by pantry'}
                                    </p>
                                    {coverage.comparableOnHand > 0 && (
                                      <p className="text-xs text-muted-foreground">{quantityFormatter.format(coverage.comparableOnHand)} {item.unit} unexpired on hand</p>
                                    )}
                                    {coverage.unconvertedStockFound && <p className="text-xs text-muted-foreground">Some pantry stock uses another unit; add a conversion to compare it.</p>}
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
    </div>
  );
}
