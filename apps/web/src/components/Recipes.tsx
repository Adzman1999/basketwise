import { useEffect, useId, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, ChefHat, CirclePlus, Pencil, Plus, Search, Trash2, Utensils } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  deleteRecipe,
  fetchGroceryItems,
  fetchRecipes,
  fetchUnits,
  saveRecipe,
  type GroceryItem,
  type MeasurementUnit,
  type Recipe,
} from '@/lib/api';

type RecipeListState =
  | { kind: 'loading' }
  | { kind: 'loaded'; page: Awaited<ReturnType<typeof fetchRecipes>> }
  | { kind: 'error'; message: string };

type RecipeIngredientDraft = {
  key: string;
  groceryItemId: string;
  itemName: string;
  unitId: string;
  unitName: string;
  quantity: string;
};

type UnitOptionsState =
  | { kind: 'loading' }
  | { kind: 'loaded'; items: MeasurementUnit[] }
  | { kind: 'error'; message: string };

type ItemOptionsState =
  | { kind: 'loading' }
  | { kind: 'loaded'; items: GroceryItem[] }
  | { kind: 'error'; message: string };

const pageSize = 8;
const quantityPattern = /^\d+(?:\.\d{1,3})?$/;
const currencyFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const unitPriceFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 4 });

function parseQuantity(value: string): number | null {
  if (!quantityPattern.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 999_999_999.999 ? parsed : null;
}

function formatCost(centavos: number): string {
  return currencyFormatter.format(centavos / 100);
}

function formatUnitPrice(centavos: number): string {
  return unitPriceFormatter.format(centavos / 100);
}

function formatScaledQuantity(quantity: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 6 }).format(quantity);
}

function formatDateOnly(date: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00.000Z`));
}

function makeIngredientDraft(recipeIngredient?: Recipe['ingredients'][number]): RecipeIngredientDraft {
  return {
    key: crypto.randomUUID(),
    groceryItemId: recipeIngredient?.groceryItemId ?? '',
    itemName: recipeIngredient?.itemName ?? '',
    unitId: recipeIngredient?.unitId ?? '',
    unitName: recipeIngredient?.unit ?? '',
    quantity: recipeIngredient ? String(recipeIngredient.quantity) : '',
  };
}

function RecipeItemPicker({
  selectedId,
  selectedName,
  disabled,
  onSelect,
}: {
  selectedId: string;
  selectedName: string;
  disabled: boolean;
  onSelect: (item: GroceryItem | null) => void;
}) {
  const listboxId = useId();
  const [query, setQuery] = useState(selectedName);
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<ItemOptionsState>({ kind: 'loading' });

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setState({ kind: 'loading' });
      void fetchGroceryItems(1, 20, query.trim(), controller.signal)
        .then((page) => {
          if (!controller.signal.aborted) setState({ kind: 'loaded', items: page.items });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not search grocery items.' });
        });
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, query]);

  function handleInput(value: string) {
    setQuery(value);
    setIsOpen(true);
    if (selectedId) onSelect(null);
  }

  return (
    <div
      className="relative min-w-0"
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          window.setTimeout(() => setIsOpen(false), 80);
        }
      }}
    >
      <Input
        role="combobox"
        aria-label="Search saved grocery items"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        className="h-10 w-full min-w-0"
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => handleInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
        disabled={disabled}
        placeholder="Search saved grocery items"
      />
      {isOpen && !disabled && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {state.kind === 'loading' && <p className="px-3 py-2 text-xs text-muted-foreground">Searching saved items…</p>}
          {state.kind === 'error' && <p className="px-3 py-2 text-xs text-destructive">{state.message}</p>}
          {state.kind === 'loaded' && state.items.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No saved grocery items match. Record a purchase to add an item to the catalog.</p>
          )}
          {state.kind === 'loaded' && state.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={selectedId === item.id}
              className="flex w-full rounded-sm px-3 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(item);
                setQuery(item.name);
                setIsOpen(false);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeEditorDialog({
  recipe,
  onOpenChange,
  onSaved,
}: {
  recipe: Recipe | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (recipe: Recipe) => void;
}) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [servings, setServings] = useState(recipe ? String(recipe.servings) : '2');
  const [ingredients, setIngredients] = useState<RecipeIngredientDraft[]>(() => (
    recipe?.ingredients.length ? recipe.ingredients.map((ingredient) => makeIngredientDraft(ingredient)) : [makeIngredientDraft()]
  ));
  const [unitState, setUnitState] = useState<UnitOptionsState>({ kind: 'loading' });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetchUnits(controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setUnitState({ kind: 'loaded', items: page.items });
      })
      .catch((caughtError: unknown) => {
        if (controller.signal.aborted) return;
        setUnitState({ kind: 'error', message: caughtError instanceof Error ? caughtError.message : 'Could not load measurement units.' });
      });
    return () => controller.abort();
  }, []);

  function updateIngredient(key: string, updates: Partial<RecipeIngredientDraft>) {
    setIngredients((current) => current.map((ingredient) => ingredient.key === key ? { ...ingredient, ...updates } : ingredient));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const parsedServings = Number(servings);
    if (!Number.isInteger(parsedServings) || parsedServings < 1 || parsedServings > 1000) {
      setError('Enter servings as a whole number from 1 to 1,000.');
      return;
    }
    const parsedIngredients = ingredients.map((ingredient) => ({
      draft: ingredient,
      quantity: parseQuantity(ingredient.quantity),
    }));
    if (parsedIngredients.some(({ draft, quantity }) => !draft.groceryItemId || !draft.unitId || quantity === null)) {
      setError('Choose a saved grocery item, unit, and positive quantity for each ingredient.');
      return;
    }
    const pairKeys = parsedIngredients.map(({ draft }) => `${draft.groceryItemId}:${draft.unitId}`);
    if (new Set(pairKeys).size !== pairKeys.length) {
      setError('Each grocery item and unit can only appear once. Update its quantity on the existing line.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveRecipe(recipe?.id ?? null, {
        name: name.trim(),
        servings: parsedServings,
        ingredients: parsedIngredients.map(({ draft, quantity }) => ({
          groceryItemId: draft.groceryItemId,
          unitId: draft.unitId,
          quantity: quantity as number,
        })),
      });
      onSaved(saved);
      onOpenChange(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save this recipe.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !isSaving && onOpenChange(open)}>
      <DialogContent className="flex max-h-[94dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b bg-background px-4 py-4 text-left sm:px-6">
          <DialogTitle>{recipe ? 'Edit recipe' : 'Create a recipe'}</DialogTitle>
          <DialogDescription>Build a recipe from saved grocery items. Ingredient estimates use the latest recorded price in the same unit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <Label htmlFor="recipe-name" className="grid min-w-0 gap-2 text-sm font-medium">
                Recipe name
                <Input id="recipe-name" className="h-10 w-full" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Chicken adobo" required disabled={isSaving} />
              </Label>
              <Label htmlFor="recipe-servings" className="grid min-w-0 gap-2 text-sm font-medium">
                Servings
                <Input id="recipe-servings" className="h-10 w-full" type="number" min="1" max="1000" step="1" value={servings} onChange={(event) => setServings(event.target.value)} required disabled={isSaving} />
              </Label>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Ingredients</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Use a unit that matches the unit on your grocery receipts.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setIngredients((current) => [...current, makeIngredientDraft()])} disabled={isSaving || ingredients.length >= 100}>
                  <Plus aria-hidden="true" /> Add ingredient
                </Button>
              </div>

              {unitState.kind === 'error' && (
                <Alert variant="destructive"><AlertTitle>Measurement units could not load</AlertTitle><AlertDescription>{unitState.message}</AlertDescription></Alert>
              )}

              <div className="space-y-2.5">
                {ingredients.map((ingredient, index) => (
                  <div key={ingredient.key} className="grid min-w-0 gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_auto] sm:items-end">
                    <div className="grid min-w-0 gap-1.5">
                      <Label className="text-xs font-medium">Ingredient {String(index + 1).padStart(2, '0')}</Label>
                      <RecipeItemPicker
                        selectedId={ingredient.groceryItemId}
                        selectedName={ingredient.itemName}
                        disabled={isSaving}
                        onSelect={(item) => updateIngredient(ingredient.key, { groceryItemId: item?.id ?? '', itemName: item?.name ?? '' })}
                      />
                    </div>
                    <Label htmlFor={`recipe-quantity-${ingredient.key}`} className="grid min-w-0 gap-1.5 text-xs font-medium">
                      Quantity
                      <Input
                        id={`recipe-quantity-${ingredient.key}`}
                        className="h-10 w-full"
                        type="number"
                        min="0.001"
                        max="999999999.999"
                        step="0.001"
                        inputMode="decimal"
                        value={ingredient.quantity}
                        onChange={(event) => updateIngredient(ingredient.key, { quantity: event.target.value })}
                        placeholder="e.g. 0.5"
                        disabled={isSaving}
                        required
                      />
                    </Label>
                    <Label className="grid min-w-0 gap-1.5 text-xs font-medium">
                      Unit
                      <Select
                        value={ingredient.unitId || 'unselected'}
                        onValueChange={(value) => {
                          const selected = unitState.kind === 'loaded' ? unitState.items.find((unit) => unit.id === value) : undefined;
                          updateIngredient(ingredient.key, { unitId: value === 'unselected' ? '' : value, unitName: selected?.name ?? '' });
                        }}
                        disabled={isSaving || unitState.kind !== 'loaded'}
                      >
                        <SelectTrigger className="h-10 w-full" aria-label={`Unit for ingredient ${index + 1}`}><SelectValue placeholder="Choose unit" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unselected">Choose unit</SelectItem>
                          {unitState.kind === 'loaded' && unitState.items.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ingredient ${index + 1}`}
                      title="Remove ingredient"
                      onClick={() => setIngredients((current) => current.filter((line) => line.key !== ingredient.key))}
                      disabled={isSaving || ingredients.length <= 1}
                      className="justify-self-end sm:mb-0.5"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                    {ingredient.itemName && ingredient.unitName && (
                      <p className="text-[11px] leading-4 text-muted-foreground sm:col-span-4">Estimated price uses recorded observations for {ingredient.itemName} per {ingredient.unitName} only.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
              <ChefHat aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Costs update from each ingredient's latest receipt price in the exact same unit. No unit conversions are applied. Recipes do not change pantry stock.</span>
            </div>
            {error && <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Could not save recipe</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-4 py-3 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving || unitState.kind === 'loading'}>{isSaving ? 'Saving…' : recipe ? 'Save changes' : 'Save recipe'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecipeDetailsDialog({
  recipe,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [targetServings, setTargetServings] = useState(String(recipe.servings));
  useEffect(() => {
    setTargetServings(String(recipe.servings));
  }, [recipe.id, recipe.servings]);

  const parsedTargetServings = Number(targetServings);
  const isValidTargetServings = Number.isInteger(parsedTargetServings)
    && parsedTargetServings >= 1
    && parsedTargetServings <= 1000;
  const scaleRatio = isValidTargetServings ? parsedTargetServings / recipe.servings : 1;
  const scaledIngredients = recipe.ingredients.map((ingredient) => ({
    ...ingredient,
    scaledQuantity: ingredient.quantity * scaleRatio,
    scaledLineCostCentavos: ingredient.lineCostCentavos === null
      ? null
      : Math.round((ingredient.unitPriceCentavos ?? ingredient.lineCostCentavos) * ingredient.quantity * scaleRatio),
  }));
  const hasFullCost = recipe.totalCostCentavos !== null;
  const scaledPartialCostCentavos = scaledIngredients.reduce(
    (total, ingredient) => total + (ingredient.scaledLineCostCentavos ?? 0),
    0,
  );
  const scaledTotalCostCentavos = hasFullCost ? scaledPartialCostCentavos : null;
  const scaledCostPerServingCentavos = scaledTotalCostCentavos !== null && isValidTargetServings
    ? Math.round(scaledTotalCostCentavos / parsedTargetServings)
    : null;
  const displayedServings = isValidTargetServings ? parsedTargetServings : recipe.servings;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b bg-background px-5 py-4 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ChefHat aria-hidden="true" className="size-4" /></span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="truncate">{recipe.name}</DialogTitle>
              <DialogDescription>{recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'} · {recipe.ingredients.length} {recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-primary/[0.04] p-4">
              <p className="text-xs text-muted-foreground">
                Estimated cost for {displayedServings} {displayedServings === 1 ? 'serving' : 'servings'}
              </p>
              {scaledTotalCostCentavos !== null ? (
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCost(scaledTotalCostCentavos)}</p>
              ) : (
                <p className="mt-1 text-lg font-semibold">Incomplete price data</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {hasFullCost
                  ? `${recipe.pricedIngredientCount} of ${recipe.ingredients.length} ingredients priced from receipts`
                  : `${recipe.unpricedIngredientCount} ${recipe.unpricedIngredientCount === 1 ? 'ingredient has' : 'ingredients have'} no matching unit price · partial ${formatCost(scaledPartialCostCentavos)}`}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Cost per serving</p>
              {scaledCostPerServingCentavos === null
                ? <p className="mt-1 text-lg font-semibold">Not available yet</p>
                : <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCost(scaledCostPerServingCentavos)}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Based on current ingredient price observations.</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end">
            <div>
              <Label htmlFor="recipe-target-servings" className="text-sm font-medium">Scale ingredients for</Label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The saved recipe makes {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}. Scaling only changes this estimate.
              </p>
            </div>
            <Input
              id="recipe-target-servings"
              type="number"
              min="1"
              max="1000"
              step="1"
              inputMode="numeric"
              value={targetServings}
              onChange={(event) => setTargetServings(event.target.value)}
              aria-invalid={!isValidTargetServings}
            />
            {!isValidTargetServings && (
              <p className="text-xs text-destructive sm:col-span-2">Enter a whole number from 1 to 1,000.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Ingredient cost breakdown</h3>
              <Badge variant="secondary">Latest same-unit price</Badge>
            </div>
            <ul className="divide-y rounded-lg border">
              {scaledIngredients.map((ingredient) => (
                <li key={ingredient.id} className="grid min-w-0 gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ingredient.itemName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatScaledQuantity(ingredient.scaledQuantity)} {ingredient.unit}
                      {ingredient.unitPriceCentavos === null ? ' · No matching price recorded' : ` · ${formatUnitPrice(ingredient.unitPriceCentavos)} / ${ingredient.unit}`}
                    </p>
                    {ingredient.pricePurchasedOn && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        Latest price: {ingredient.priceStoreName || 'Grocery trip'} · {formatDateOnly(ingredient.pricePurchasedOn)}
                      </p>
                    )}
                  </div>
                  <p className="text-right text-sm font-semibold tabular-nums">
                    {ingredient.scaledLineCostCentavos === null ? '—' : formatCost(ingredient.scaledLineCostCentavos)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-5 text-muted-foreground">Ingredient prices can be from different receipt dates. Add a grocery purchase to refresh an ingredient's estimate.</p>
          </div>
        </div>
        <DialogFooter className="shrink-0 flex-col-reverse border-t bg-background px-5 py-3 sm:flex-row sm:justify-between sm:px-6">
          <Button type="button" variant="destructive" onClick={onDelete}><Trash2 aria-hidden="true" /> Delete recipe</Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button type="button" onClick={onEdit}><Pencil aria-hidden="true" /> Edit recipe</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRecipeDialog({
  recipe,
  onOpenChange,
  onDeleted,
}: {
  recipe: Recipe;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setError('');
    setIsDeleting(true);
    try {
      await deleteRecipe(recipe.id);
      onDeleted();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete this recipe.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !isDeleting && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {recipe.name}?</DialogTitle>
          <DialogDescription>This removes the recipe and its ingredient list. Grocery receipts and price history stay unchanged.</DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertTitle>Could not delete recipe</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>{isDeleting ? 'Deleting…' : 'Delete recipe'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Recipes() {
  const [state, setState] = useState<RecipeListState>({ kind: 'loading' });
  const [pageNumber, setPageNumber] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deletingRecipe, setDeletingRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchText.trim());
      setPageNumber(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });
    void fetchRecipes(pageNumber, pageSize, searchQuery, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setState({ kind: 'loaded', page });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load recipes.' });
      });
    return () => controller.abort();
  }, [pageNumber, refreshKey, searchQuery]);

  const page = state.kind === 'loaded' ? state.page : null;
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / pageSize));

  function openEditor(recipe: Recipe | null) {
    setSelectedRecipe(null);
    setEditingRecipe(recipe);
    setIsEditorOpen(true);
  }

  function handleSaved(recipe: Recipe) {
    setIsEditorOpen(false);
    setSelectedRecipe(recipe);
    setPageNumber(1);
    setRefreshKey((current) => current + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Badge variant="secondary" className="w-fit gap-1.5"><ChefHat aria-hidden="true" className="size-4" /> Kitchen planning</Badge>
          <h2 className="text-2xl font-semibold tracking-tight">Recipes & ingredient costs</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Estimate each recipe from the latest grocery prices recorded for the same item and unit.</p>
        </div>
        <Button type="button" onClick={() => openEditor(null)}><CirclePlus aria-hidden="true" /> Create recipe</Button>
      </div>

      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 space-y-0 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base"><Utensils aria-hidden="true" className="size-4 text-primary" /> Your recipes</CardTitle>
            <CardDescription>Cost estimates change as you record new grocery prices.</CardDescription>
          </div>
          <div className="relative w-full min-w-0 sm:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10 w-full min-w-0 pl-9" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search recipes" aria-label="Search recipes" />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {state.kind === 'loading' && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading recipes">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-48" />)}
            </div>
          )}

          {state.kind === 'error' && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Recipes could not load</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{state.message}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setRefreshKey((current) => current + 1)}>Try again</Button>
              </AlertDescription>
            </Alert>
          )}

          {page && page.items.length === 0 && (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
              <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><ChefHat aria-hidden="true" className="size-5" /></span>
              <p className="text-sm font-medium">{searchQuery ? 'No recipes match your search' : 'No recipes saved yet'}</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                {searchQuery ? 'Try a different recipe name.' : 'Create a recipe from your saved grocery items. Record a purchase first if you need to add new ingredients to the catalog.'}
              </p>
              {!searchQuery && <Button type="button" variant="outline" className="mt-4" onClick={() => openEditor(null)}><Plus aria-hidden="true" /> Create your first recipe</Button>}
            </div>
          )}

          {page && page.items.length > 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {page.items.map((recipe) => (
                  <Card key={recipe.id} className="flex min-w-0 flex-col shadow-none">
                    <CardContent className="flex flex-1 flex-col p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><ChefHat aria-hidden="true" className="size-4" /></span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">{recipe.name}</h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">{recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'} · {recipe.ingredients.length} {recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}</p>
                          </div>
                        </div>
                        <Badge variant={recipe.unpricedIngredientCount > 0 ? 'outline' : 'secondary'} className="shrink-0">
                          {recipe.unpricedIngredientCount > 0 ? `${recipe.unpricedIngredientCount} unpriced` : 'Estimated'}
                        </Badge>
                      </div>
                      <div className="mt-4 rounded-md bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Recipe cost</p>
                        {recipe.totalCostCentavos === null
                          ? <p className="mt-1 text-lg font-semibold">Incomplete estimate</p>
                          : <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCost(recipe.totalCostCentavos)}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {recipe.costPerServingCentavos === null
                            ? `Partial estimate ${formatCost(recipe.partialCostCentavos)}`
                            : `${formatCost(recipe.costPerServingCentavos)} per serving`}
                        </p>
                      </div>
                      <p className="mt-3 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
                        {recipe.ingredients.slice(0, 4).map((ingredient) => ingredient.itemName).join(' · ')}{recipe.ingredients.length > 4 ? ' · …' : ''}
                      </p>
                      <div className="mt-auto flex justify-end gap-2 border-t pt-3">
                        <Button type="button" variant="outline" size="sm" onClick={() => setSelectedRecipe(recipe)}>View cost</Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${recipe.name}`} title="Edit recipe" onClick={() => openEditor(recipe)}><Pencil aria-hidden="true" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {page.total > pageSize && (
                <nav className="mt-5 flex items-center justify-between gap-3 border-t pt-4" aria-label="Recipe pages">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPageNumber((current) => current - 1)} disabled={pageNumber <= 1 || state.kind === 'loading'}><ArrowLeft aria-hidden="true" /> Previous</Button>
                  <span className="text-sm tabular-nums text-muted-foreground">Showing {(pageNumber - 1) * pageSize + 1}–{Math.min(pageNumber * pageSize, page.total)} of {page.total}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPageNumber((current) => current + 1)} disabled={pageNumber >= totalPages || state.kind === 'loading'}>Next <ArrowRight aria-hidden="true" /></Button>
                </nav>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {isEditorOpen && (
        <RecipeEditorDialog
          key={editingRecipe?.id ?? 'new-recipe'}
          recipe={editingRecipe}
          onOpenChange={(open) => { if (!open) setIsEditorOpen(false); }}
          onSaved={handleSaved}
        />
      )}
      {selectedRecipe && (
        <RecipeDetailsDialog
          recipe={selectedRecipe}
          onOpenChange={(open) => { if (!open) setSelectedRecipe(null); }}
          onEdit={() => openEditor(selectedRecipe)}
          onDelete={() => {
            setDeletingRecipe(selectedRecipe);
            setSelectedRecipe(null);
          }}
        />
      )}
      {deletingRecipe && (
        <DeleteRecipeDialog
          recipe={deletingRecipe}
          onOpenChange={(open) => { if (!open) setDeletingRecipe(null); }}
          onDeleted={() => {
            setDeletingRecipe(null);
            setPageNumber(1);
            setRefreshKey((current) => current + 1);
          }}
        />
      )}
    </div>
  );
}
