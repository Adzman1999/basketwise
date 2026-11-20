import { describe, expect, it } from 'vitest';
import type { GroceryItemUnitConversion, PantryStockItem, PantryStockLot } from './api';
import { getPantryCoverage, type PantryComparisonData, type ShoppingListItem } from './pantryCoverage';

const groceryItemId = 'grocery-item-1';

function shoppingItem(unitId: string, unit: string, quantity: number): ShoppingListItem {
  return { groceryItemId, itemName: 'Rice', unitId, unit, quantity, plannedMealCount: 1 };
}

function pantryStock(id: string, unitId: string, unit: string, quantity: number, expiresOn: string | null = null): PantryStockItem {
  return {
    id,
    groceryItemId,
    itemName: 'Rice',
    unitId,
    unit,
    quantity,
    lowStockThreshold: null,
    autoRestock: false,
    expiresOn,
    status: quantity > 0 ? 'in_stock' : 'out_of_stock',
    updatedAt: '2026-11-20T00:00:00.000Z',
  };
}

function pantryLot(id: string, stockId: string, quantityRemaining: number, expiresOn: string | null): PantryStockLot {
  return {
    id,
    pantryStockId: stockId,
    itemName: 'Rice',
    unit: 'g',
    quantityReceived: quantityRemaining,
    quantityRemaining,
    sourceType: 'opening_balance',
    expiresOn,
    receivedAt: '2026-11-20T00:00:00.000Z',
    purchaseDate: null,
    storeName: null,
  };
}

function conversion(
  purchaseUnitId: string,
  recipeUnitId: string,
  recipeUnitsPerPurchaseUnit: number,
): GroceryItemUnitConversion {
  return {
    id: `${purchaseUnitId}-${recipeUnitId}`,
    purchaseUnitId,
    purchaseUnit: purchaseUnitId,
    recipeUnitId,
    recipeUnit: recipeUnitId,
    recipeUnitsPerPurchaseUnit,
  };
}

function pantryData(
  stocks: PantryStockItem[],
  lots: PantryStockLot[] = [],
  conversions: GroceryItemUnitConversion[] = [],
): PantryComparisonData {
  return {
    stocks,
    lots,
    conversionsByGroceryItemId: new Map([[groceryItemId, conversions]]),
  };
}

describe('getPantryCoverage', () => {
  it('subtracts unexpired stock in the exact same unit and excludes expired lots', () => {
    const item = shoppingItem('unit-g', 'g', 2000);
    const stock = pantryStock('stock-1', 'unit-g', 'g', 1500);
    const result = getPantryCoverage(item, pantryData(
      [stock],
      [
        pantryLot('lot-fresh', stock.id, 1500, '2026-12-01'),
        pantryLot('lot-expired', stock.id, 500, '2026-11-19'),
      ],
    ), '2026-11-20');

    expect(result).toEqual({
      comparableOnHand: 1500,
      amountToBuy: 500,
      expiredStockFound: true,
      unconvertedStockFound: false,
    });
  });

  it('applies saved conversions from pantry units to the ingredient unit', () => {
    const item = shoppingItem('unit-cup', 'cup', 9);
    const stock = pantryStock('stock-2', 'unit-pack', 'pack', 2);
    const result = getPantryCoverage(item, pantryData(
      [stock],
      [pantryLot('lot-pack', stock.id, 2, null)],
      [conversion('unit-pack', 'unit-cup', 4)],
    ), '2026-11-20');

    expect(result.comparableOnHand).toBe(8);
    expect(result.amountToBuy).toBe(1);
    expect(result.unconvertedStockFound).toBe(false);
  });

  it('applies reverse saved and standard metric conversions', () => {
    const reverseItem = shoppingItem('unit-kg', 'kg', 1);
    const grams = pantryStock('stock-grams', 'unit-g', 'g', 500);
    const reverseResult = getPantryCoverage(reverseItem, pantryData(
      [grams],
      [pantryLot('lot-g', grams.id, 500, null)],
      [conversion('unit-kg', 'unit-g', 1000)],
    ), '2026-11-20');

    const metricItem = shoppingItem('unit-ml', 'ml', 1250);
    const liters = pantryStock('stock-liters', 'unit-l', 'l', 1);
    const metricResult = getPantryCoverage(metricItem, pantryData(
      [liters],
      [pantryLot('lot-l', liters.id, 1, null)],
    ), '2026-11-20');

    expect(reverseResult.comparableOnHand).toBe(0.5);
    expect(reverseResult.amountToBuy).toBe(0.5);
    expect(metricResult.comparableOnHand).toBe(1000);
    expect(metricResult.amountToBuy).toBe(250);
  });

  it('marks stock in an unknown unit and reports only the minimum amount still needed', () => {
    const item = shoppingItem('unit-cup', 'cup', 5);
    const stock = pantryStock('stock-bag', 'unit-bag', 'bag', 2);
    const result = getPantryCoverage(item, pantryData(
      [stock],
      [pantryLot('lot-bag', stock.id, 2, null)],
    ), '2026-11-20');

    expect(result.comparableOnHand).toBe(0);
    expect(result.amountToBuy).toBe(5);
    expect(result.unconvertedStockFound).toBe(true);
  });
});
