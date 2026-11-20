import { describe, expect, it } from 'vitest';
import { getPurchasedShoppingItemKeys, type PurchaseDraftCompletionLine } from './purchaseDraft';

const sourceLine: PurchaseDraftCompletionLine = {
  sourceShoppingKey: 'rice:g',
  sourceItemName: 'Rice',
  sourceQuantity: 500,
  sourceUnit: 'g',
  itemName: ' rice ',
  quantity: 500,
  unit: 'G',
};

describe('getPurchasedShoppingItemKeys', () => {
  it('returns keys for unchanged lines purchased at or above their suggested quantity', () => {
    expect(getPurchasedShoppingItemKeys([
      sourceLine,
      { ...sourceLine, quantity: 750 },
    ])).toEqual(['rice:g']);
  });

  it('does not check renamed, re-unitized, or partial lines', () => {
    expect(getPurchasedShoppingItemKeys([
      { ...sourceLine, itemName: 'Brown rice' },
      { ...sourceLine, unit: 'kg' },
      { ...sourceLine, quantity: 250 },
      { ...sourceLine, sourceShoppingKey: null },
    ])).toEqual([]);
  });

  it('returns distinct keys when the receipt contains several matching draft lines', () => {
    expect(getPurchasedShoppingItemKeys([
      sourceLine,
      { ...sourceLine, sourceShoppingKey: 'oil:ml', itemName: 'Cooking oil', sourceItemName: 'Cooking oil', unit: 'ml', sourceUnit: 'ml' },
    ])).toEqual(['rice:g', 'oil:ml']);
  });
});
