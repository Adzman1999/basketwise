export type HealthResponse = {
  status: 'healthy';
  app: 'Basketwise API';
  timestamp: string;
};

export type CreatePurchaseItem = {
  itemName: string;
  quantity: number;
  unit: string;
  amountPaidCentavos: number;
  expiresOn?: string | null;
};

export type CreatePurchaseRequest = {
  purchasedOn: string;
  storeName?: string;
  addToPantry: boolean;
  items: CreatePurchaseItem[];
};

export type PurchaseItem = CreatePurchaseItem & {
  id: string;
  groceryItemId: string;
  expiresOn: string | null;
  pantryAdded: boolean;
};

export type Purchase = {
  id: string;
  purchasedOn: string;
  storeName?: string;
  currency: 'PHP';
  totalPaidCentavos: number;
  unallocatedAmountCentavos: number;
  items: PurchaseItem[];
  createdAt: string;
  pantryRestockedItems?: PantryRestockedItem[];
};

export type PantryRestockedItem = {
  itemName: string;
  unit: string;
  quantityAdded: number;
  quantityOnHand: number;
  expiresOn: string | null;
};

export type PurchasePage = {
  items: Purchase[];
  page: number;
  pageSize: number;
  total: number;
};

export type PurchaseFilterOptions = {
  store: string;
  from: string;
  to: string;
};

export type PurchaseFilters = PurchaseFilterOptions & {
  search: string;
};

export type BudgetPeriodType = 'day' | 'week' | 'month' | 'year' | 'custom';

export type BudgetPeriod = {
  periodType: BudgetPeriodType;
  startsOn: string;
  endsOn: string;
};

export type GroceryBudgetSummary = BudgetPeriod & {
  currency: 'PHP';
  budgetCentavos: number | null;
  spentCentavos: number;
  receiptCount: number;
  remainingCentavos: number | null;
};

export type BudgetCalendarDayStatus = 'no_target' | 'remaining' | 'at_limit' | 'exceeded';

export type GroceryBudgetCalendarDay = {
  date: string;
  budgetCentavos: number | null;
  spentCentavos: number;
  receiptCount: number;
  remainingCentavos: number | null;
  status: BudgetCalendarDayStatus;
};

export type GroceryBudgetCalendar = {
  month: string;
  days: GroceryBudgetCalendarDay[];
};

export type GroceryItem = {
  id: string;
  name: string;
};

export const storeCategories = [
  'supermarket',
  'public_market',
  'convenience_store',
  'neighborhood_grocery',
  'online_grocery',
  'other',
] as const;

export type StoreCategory = (typeof storeCategories)[number];

export const storeCategoryLabels: Record<StoreCategory, string> = {
  supermarket: 'Supermarket',
  public_market: 'Public market',
  convenience_store: 'Convenience store',
  neighborhood_grocery: 'Neighborhood grocery',
  online_grocery: 'Online grocery',
  other: 'Other',
};

export type Store = {
  id: string;
  name: string;
  category: StoreCategory;
  createdAt: string;
};

export type StorePage = {
  items: Store[];
  total: number;
};

export type MeasurementUnit = {
  id: string;
  name: string;
  isPreset: boolean;
  createdAt: string;
};

export type MeasurementUnitPage = {
  items: MeasurementUnit[];
  total: number;
};

export type PantryStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export type PantryStockItem = {
  id: string;
  groceryItemId: string;
  itemName: string;
  unitId: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number | null;
  autoRestock: boolean;
  expiresOn: string | null;
  status: PantryStockStatus;
  updatedAt: string;
};

export type PantryStockSummary = {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
};

export type PantryStockPage = {
  items: PantryStockItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: PantryStockSummary;
};

export type PantryStockLotSource = 'opening_balance' | 'purchase' | 'manual_adjustment';

export type PantryStockLot = {
  id: string;
  pantryStockId: string;
  itemName: string;
  unit: string;
  quantityReceived: number;
  quantityRemaining: number;
  sourceType: PantryStockLotSource;
  expiresOn: string | null;
  receivedAt: string;
  purchaseDate: string | null;
  storeName: string | null;
};

export type PantryStockLotPage = {
  items: PantryStockLot[];
  page: number;
  pageSize: number;
  total: number;
};

export type PantryStockWaste = {
  id: string;
  lotId: string | null;
  itemName: string;
  unit: string;
  quantityWasted: number;
  quantityRemainingAfter: number;
  discardedAt: string;
  expiresOn: string | null;
  receivedAt: string;
  purchaseDate: string | null;
  storeName: string | null;
};

export type PantryStockWastePage = {
  items: PantryStockWaste[];
  page: number;
  pageSize: number;
  total: number;
};

export type GroceryItemPage = {
  items: GroceryItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type RecipeIngredientInput = {
  groceryItemId: string;
  unitId: string;
  quantity: number;
};

export type RecipeIngredient = RecipeIngredientInput & {
  id: string;
  recipeId: string;
  itemName: string;
  unit: string;
  unitPriceCentavos: number | null;
  lineCostCentavos: number | null;
  pricePurchasedOn: string | null;
  priceStoreName: string | null;
};

export type Recipe = {
  id: string;
  name: string;
  servings: number;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredient[];
  pricedIngredientCount: number;
  unpricedIngredientCount: number;
  partialCostCentavos: number;
  totalCostCentavos: number | null;
  costPerServingCentavos: number | null;
};

export type RecipePage = {
  items: Recipe[];
  page: number;
  pageSize: number;
  total: number;
};

export type PriceObservation = {
  purchaseItemId: string;
  purchaseId: string;
  purchasedOn: string;
  storeName?: string;
  itemName: string;
  quantity: number;
  unit: string;
  amountPaidCentavos: number;
  unitPriceCentavos: number;
};

export type PriceHistoryPage = {
  groceryItem: GroceryItem;
  items: PriceObservation[];
  page: number;
  pageSize: number;
  total: number;
};

type ApiErrorResponse = {
  error?: {
    message?: unknown;
  };
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    if (typeof body.error?.message === 'string') return body.error.message;
  } catch {
    // Use the HTTP status when the response is not JSON.
  }

  return `The API responded with HTTP ${response.status}.`;
}

async function sendRequest<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error('Could not reach the API. Check that the backend is running.');
  }

  if (!response.ok) throw new Error(await readErrorMessage(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchHealthStatus(signal: AbortSignal): Promise<HealthResponse> {
  return sendRequest<HealthResponse>('/api/health', {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function fetchPurchases(
  page: number,
  pageSize: number,
  filters: PurchaseFilters,
  signal: AbortSignal
): Promise<PurchasePage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.store.trim()) params.set('store', filters.store.trim());
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return sendRequest<PurchasePage>(`/api/purchases?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function fetchPurchasesNeedingPantry(
  page: number,
  pageSize: number,
  signal: AbortSignal
): Promise<PurchasePage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    pantryStatus: 'pending',
  });
  return sendRequest<PurchasePage>(`/api/purchases?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
}

function budgetPath(period: BudgetPeriod): string {
  return `/api/budgets/${period.periodType}/${encodeURIComponent(period.startsOn)}/${encodeURIComponent(period.endsOn)}`;
}

export async function fetchGroceryBudget(period: BudgetPeriod, signal: AbortSignal): Promise<GroceryBudgetSummary> {
  return sendRequest<GroceryBudgetSummary>(budgetPath(period), {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function fetchGroceryBudgetCalendar(
  month: string,
  signal: AbortSignal
): Promise<GroceryBudgetCalendar> {
  return sendRequest<GroceryBudgetCalendar>(`/api/budgets/calendar/${encodeURIComponent(month)}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function saveGroceryBudget(period: BudgetPeriod, budgetCentavos: number): Promise<GroceryBudgetSummary> {
  return sendRequest<GroceryBudgetSummary>(budgetPath(period), {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ budgetCentavos }),
  });
}

export async function deleteGroceryBudget(period: BudgetPeriod): Promise<GroceryBudgetSummary> {
  return sendRequest<GroceryBudgetSummary>(budgetPath(period), {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
}

export async function fetchGroceryItems(
  page: number,
  pageSize: number,
  search: string,
  signal: AbortSignal
): Promise<GroceryItemPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) params.set('search', search.trim());
  return sendRequest<GroceryItemPage>(`/api/grocery-items?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function fetchRecipes(
  page: number,
  pageSize: number,
  search: string,
  signal: AbortSignal
): Promise<RecipePage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) params.set('search', search.trim());
  return sendRequest<RecipePage>(`/api/recipes?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function saveRecipe(
  recipeId: string | null,
  input: { name: string; servings: number; ingredients: RecipeIngredientInput[] }
): Promise<Recipe> {
  const isUpdate = recipeId !== null;
  return sendRequest<Recipe>(isUpdate ? `/api/recipes/${encodeURIComponent(recipeId)}` : '/api/recipes', {
    method: isUpdate ? 'PUT' : 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await sendRequest<void>(`/api/recipes/${encodeURIComponent(recipeId)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
}

export async function fetchStores(signal: AbortSignal): Promise<StorePage> {
  return sendRequest<StorePage>('/api/stores', {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function createStore(input: { name: string; category: StoreCategory }): Promise<Store> {
  return sendRequest<Store>('/api/stores', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function fetchUnits(signal: AbortSignal): Promise<MeasurementUnitPage> {
  return sendRequest<MeasurementUnitPage>('/api/units', {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function createUnit(name: string): Promise<MeasurementUnit> {
  return sendRequest<MeasurementUnit>('/api/units', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
}

export async function fetchPantryStock(
  page: number,
  pageSize: number,
  search: string,
  status: PantryStockStatus | '',
  signal: AbortSignal
): Promise<PantryStockPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);
  return sendRequest<PantryStockPage>(`/api/pantry?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function fetchPantryStockLots(
  page: number,
  pageSize: number,
  search: string,
  signal: AbortSignal
): Promise<PantryStockLotPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) params.set('search', search.trim());
  return sendRequest<PantryStockLotPage>(`/api/pantry/lots?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function fetchPantryStockWaste(
  page: number,
  pageSize: number,
  search: string,
  signal: AbortSignal
): Promise<PantryStockWastePage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) params.set('search', search.trim());
  return sendRequest<PantryStockWastePage>(`/api/pantry/waste?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
}

export async function updatePantryStockLotExpiry(
  id: string,
  expiresOn: string | null
): Promise<PantryStockLot> {
  return sendRequest<PantryStockLot>(`/api/pantry/lots/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresOn }),
  });
}

export async function recordPantryStockWaste(lotId: string, quantity: number): Promise<PantryStockWaste> {
  return sendRequest<PantryStockWaste>(`/api/pantry/lots/${encodeURIComponent(lotId)}/waste`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ quantity }),
  });
}

export async function createPantryStock(input: {
  groceryItemId: string;
  unitId: string;
  quantity: number;
  lowStockThreshold: number | null;
  autoRestock: boolean;
  expiresOn: string | null;
}): Promise<PantryStockItem> {
  return sendRequest<PantryStockItem>('/api/pantry', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function updatePantryStock(
  id: string,
  input: { quantity: number; lowStockThreshold: number | null; autoRestock: boolean }
): Promise<PantryStockItem> {
  return sendRequest<PantryStockItem>(`/api/pantry/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deletePantryStock(id: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/pantry/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Could not reach the API. Check that the backend is running.');
  }
  if (!response.ok) throw new Error(await readErrorMessage(response));
}

export async function fetchGroceryItemPriceHistory(
  groceryItemId: string,
  page: number,
  pageSize: number,
  signal: AbortSignal
): Promise<PriceHistoryPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return sendRequest<PriceHistoryPage>(
    `/api/grocery-items/${encodeURIComponent(groceryItemId)}/price-history?${params.toString()}`,
    { headers: { Accept: 'application/json' }, signal }
  );
}

export async function createPurchase(input: CreatePurchaseRequest): Promise<Purchase> {
  return sendRequest<Purchase>('/api/purchases', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function addPurchaseItemsToPantry(
  purchaseId: string,
  expiryDates: { purchaseItemId: string; expiresOn: string | null }[] = []
): Promise<PantryRestockedItem[]> {
  const response = await sendRequest<{ pantryRestockedItems: PantryRestockedItem[] }>(
    `/api/purchases/${encodeURIComponent(purchaseId)}/pantry`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiryDates }),
    }
  );
  return response.pantryRestockedItems;
}
