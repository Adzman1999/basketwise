export type PurchaseDraftLine = {
  shoppingItemKey: string;
  itemName: string;
  quantity: number;
  unit: string;
  needsUnitReview: boolean;
};

export type PurchaseDraftCompletionLine = {
  sourceShoppingKey: string | null;
  sourceItemName: string;
  sourceQuantity: number | null;
  sourceUnit: string;
  itemName: string;
  quantity: number;
  unit: string;
};

function normalizeDraftText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getPurchasedShoppingItemKeys(lines: PurchaseDraftCompletionLine[]): string[] {
  return Array.from(new Set(lines.flatMap((line) => {
    if (
      !line.sourceShoppingKey
      || line.sourceQuantity === null
      || normalizeDraftText(line.itemName) !== normalizeDraftText(line.sourceItemName)
      || normalizeDraftText(line.unit) !== normalizeDraftText(line.sourceUnit)
      || !Number.isFinite(line.quantity)
      || line.quantity < line.sourceQuantity
    ) return [];
    return [line.sourceShoppingKey];
  })));
}
