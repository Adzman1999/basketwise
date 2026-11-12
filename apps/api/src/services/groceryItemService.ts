import {
  deleteGroceryItemUnitConversionRecord,
  listGroceryItemUnitConversionRecords,
  listGroceryItemRecords,
  listPriceHistoryRecords,
  saveGroceryItemUnitConversionRecord,
} from '../repositories/groceryItemRepository';
import type {
  GroceryItemListQuery,
  PriceHistoryQuery,
  SaveGroceryItemUnitConversionInput,
} from '../schemas/groceryItem';

export async function listGroceryItems(input: GroceryItemListQuery) {
  const result = await listGroceryItemRecords(input);

  return {
    ...result,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function listGroceryItemPriceHistory(
  groceryItemId: string,
  input: PriceHistoryQuery
) {
  const result = await listPriceHistoryRecords(groceryItemId, input);
  if (!result.groceryItem) return null;

  return {
    groceryItem: result.groceryItem,
    units: result.units,
    items: result.observations.map(({ storeName, ...observation }) => ({
      ...observation,
      quantity: Number(observation.quantity),
      unitPriceCentavos: Number(observation.unitPriceCentavos),
      ...(storeName === null ? {} : { storeName }),
    })),
    page: input.page,
    pageSize: input.pageSize,
    total: result.total,
  };
}

export async function listGroceryItemUnitConversions(groceryItemId: string) {
  const result = await listGroceryItemUnitConversionRecords(groceryItemId);
  if (!result.groceryItem) return null;
  return {
    groceryItem: result.groceryItem,
    items: result.items.map((conversion) => ({
      ...conversion,
      recipeUnitsPerPurchaseUnit: Number(conversion.recipeUnitsPerPurchaseUnit),
    })),
  };
}

export async function saveGroceryItemUnitConversion(
  groceryItemId: string,
  input: SaveGroceryItemUnitConversionInput
) {
  const conversion = await saveGroceryItemUnitConversionRecord(groceryItemId, input);
  if (!conversion) return null;
  return {
    ...conversion,
    recipeUnitsPerPurchaseUnit: Number(conversion.recipeUnitsPerPurchaseUnit),
  };
}

export async function deleteGroceryItemUnitConversion(groceryItemId: string, conversionId: string) {
  return deleteGroceryItemUnitConversionRecord(groceryItemId, conversionId);
}
