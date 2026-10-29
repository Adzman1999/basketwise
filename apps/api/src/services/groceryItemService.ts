import {
  listGroceryItemRecords,
  listPriceHistoryRecords,
} from '../repositories/groceryItemRepository';
import type { GroceryItemListQuery, PriceHistoryQuery } from '../schemas/groceryItem';

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
