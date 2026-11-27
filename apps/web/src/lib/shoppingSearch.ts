import type { ShoppingListItem } from './pantryCoverage';

export type CloseShoppingMatch = {
  item: ShoppingListItem;
  matchedPart: string;
  distance: number;
};

function editDistance(left: string, right: string): number {
  const distances = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let index = 0; index <= left.length; index += 1) distances[index][0] = index;
  for (let index = 0; index <= right.length; index += 1) distances[0][index] = index;

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      distances[leftIndex][rightIndex] = Math.min(
        distances[leftIndex - 1][rightIndex] + 1,
        distances[leftIndex][rightIndex - 1] + 1,
        distances[leftIndex - 1][rightIndex - 1] + substitutionCost,
      );
      if (leftIndex > 1 && rightIndex > 1
        && left[leftIndex - 1] === right[rightIndex - 2]
        && left[leftIndex - 2] === right[rightIndex - 1]) {
        distances[leftIndex][rightIndex] = Math.min(
          distances[leftIndex][rightIndex],
          distances[leftIndex - 2][rightIndex - 2] + 1,
        );
      }
    }
  }
  return distances[left.length][right.length];
}

export function findCloseShoppingMatches(items: ShoppingListItem[], query: string): CloseShoppingMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 3 || normalizedQuery.length > 120) return [];
  const threshold = Math.max(1, Math.floor(normalizedQuery.length * 0.3));

  return items.flatMap((item) => {
    const candidates = normalizedQuery.includes(' ')
      ? [{ text: item.itemName, distance: editDistance(normalizedQuery, item.itemName.toLowerCase()) }]
      : Array.from(item.itemName.matchAll(/\S+/g), ([text]) => ({
        text,
        distance: editDistance(normalizedQuery, text.toLowerCase()),
      }));
    const closest = candidates.sort((left, right) => left.distance - right.distance)[0];
    return closest && closest.distance <= threshold
      ? [{ item, matchedPart: closest.text, distance: closest.distance }]
      : [];
  })
    .sort((left, right) => left.distance - right.distance || left.item.itemName.localeCompare(right.item.itemName))
    .slice(0, 3);
}
