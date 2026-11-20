import type { GroceryItemUnitConversion, PantryStockItem, PantryStockLot } from './api';

export type ShoppingListItem = {
  groceryItemId: string;
  itemName: string;
  unitId: string;
  unit: string;
  quantity: number;
  plannedMealCount: number;
};

export type PantryComparisonData = {
  stocks: PantryStockItem[];
  lots: PantryStockLot[];
  conversionsByGroceryItemId: Map<string, GroceryItemUnitConversion[]>;
};

const metricUnits: Record<string, { family: 'mass' | 'volume'; baseUnits: number }> = {
  g: { family: 'mass', baseUnits: 1 },
  kg: { family: 'mass', baseUnits: 1000 },
  ml: { family: 'volume', baseUnits: 1 },
  l: { family: 'volume', baseUnits: 1000 },
};

function stockToShoppingUnitFactor(
  stock: PantryStockItem,
  item: ShoppingListItem,
  conversions: GroceryItemUnitConversion[],
): number | null {
  if (stock.unitId === item.unitId) return 1;

  const savedConversion = conversions.find((conversion) => (
    conversion.purchaseUnitId === stock.unitId && conversion.recipeUnitId === item.unitId
  ));
  if (savedConversion) return savedConversion.recipeUnitsPerPurchaseUnit;

  const reverseConversion = conversions.find((conversion) => (
    conversion.purchaseUnitId === item.unitId && conversion.recipeUnitId === stock.unitId
  ));
  if (reverseConversion) return 1 / reverseConversion.recipeUnitsPerPurchaseUnit;

  const stockMetric = metricUnits[stock.unit.trim().toLowerCase()];
  const shoppingMetric = metricUnits[item.unit.trim().toLowerCase()];
  if (!stockMetric || !shoppingMetric || stockMetric.family !== shoppingMetric.family) return null;
  return stockMetric.baseUnits / shoppingMetric.baseUnits;
}

export function getPantryCoverage(
  item: ShoppingListItem,
  pantry: PantryComparisonData,
  today: string,
) {
  const conversions = pantry.conversionsByGroceryItemId.get(item.groceryItemId) ?? [];
  let comparableOnHand = 0;
  let expiredStockFound = false;
  let unconvertedStockFound = false;
  const unconvertedStockUnits = new Map<string, { unitId: string; unit: string; quantity: number }>();

  for (const stock of pantry.stocks.filter((candidate) => candidate.groceryItemId === item.groceryItemId)) {
    const stockLots = pantry.lots.filter((lot) => lot.pantryStockId === stock.id);
    let usableQuantity = 0;
    let expiredQuantity = 0;
    if (stockLots.length === 0) {
      if (stock.expiresOn && stock.expiresOn < today) expiredQuantity = stock.quantity;
      else usableQuantity = stock.quantity;
    } else {
      for (const lot of stockLots) {
        if (lot.expiresOn && lot.expiresOn < today) expiredQuantity += lot.quantityRemaining;
        else usableQuantity += lot.quantityRemaining;
      }
    }

    const factor = stockToShoppingUnitFactor(stock, item, conversions);
    if (expiredQuantity > 0) expiredStockFound = true;
    if (usableQuantity > 0 && factor === null) {
      unconvertedStockFound = true;
      const existingUnit = unconvertedStockUnits.get(stock.unitId);
      unconvertedStockUnits.set(stock.unitId, {
        unitId: stock.unitId,
        unit: existingUnit?.unit ?? stock.unit,
        quantity: (existingUnit?.quantity ?? 0) + usableQuantity,
      });
      continue;
    }
    if (factor !== null) comparableOnHand += usableQuantity * factor;
  }

  comparableOnHand = Math.round(comparableOnHand * 1000) / 1000;
  return {
    comparableOnHand,
    amountToBuy: Math.max(0, Math.round((item.quantity - comparableOnHand) * 1000) / 1000),
    expiredStockFound,
    unconvertedStockFound,
    unconvertedStockUnits: Array.from(unconvertedStockUnits.values())
      .sort((left, right) => left.unit.localeCompare(right.unit)),
  };
}
