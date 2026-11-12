import {
  deleteRecipeRecord,
  getRecipeRecord,
  listRecipeRecords,
  recipeReferencesExist,
  saveRecipeRecord,
  type RecipeRecord,
} from '../repositories/recipeRepository';
import type { RecipeListQuery, SaveRecipeInput } from '../schemas/recipe';

export class InvalidRecipeIngredientReferenceError extends Error {
  constructor() {
    super('Choose saved grocery items and measurement units for every ingredient.');
    this.name = 'InvalidRecipeIngredientReferenceError';
  }
}

function presentRecipe(record: RecipeRecord) {
  const ingredients = record.ingredients.map((ingredient) => {
    const quantity = Number(ingredient.quantity);
    const unitPriceCentavos = ingredient.unitPriceCentavos === null
      ? null
      : Number(ingredient.unitPriceCentavos);
    const priceConversionFactor = ingredient.priceConversionFactor === null
      ? null
      : Number(ingredient.priceConversionFactor);
    const lineCostCentavos = unitPriceCentavos === null
      ? null
      : Math.round(quantity * unitPriceCentavos);
    return {
      ...ingredient,
      quantity,
      unitPriceCentavos,
      priceConversionFactor,
      lineCostCentavos,
    };
  });
  const pricedIngredientCount = ingredients.filter((ingredient) => ingredient.lineCostCentavos !== null).length;
  const unpricedIngredientCount = ingredients.length - pricedIngredientCount;
  const partialCostCentavos = ingredients.reduce(
    (total, ingredient) => total + (ingredient.lineCostCentavos ?? 0),
    0
  );
  const totalCostCentavos = unpricedIngredientCount === 0 ? partialCostCentavos : null;

  return {
    ...record,
    ingredients,
    pricedIngredientCount,
    unpricedIngredientCount,
    partialCostCentavos,
    totalCostCentavos,
    costPerServingCentavos: totalCostCentavos === null
      ? null
      : Math.round(totalCostCentavos / record.servings),
  };
}

export async function listRecipes(input: RecipeListQuery) {
  const result = await listRecipeRecords(input);
  return {
    items: result.items.map(presentRecipe),
    page: input.page,
    pageSize: input.pageSize,
    total: result.total,
  };
}

export async function getRecipe(id: string) {
  const record = await getRecipeRecord(id);
  return record ? presentRecipe(record) : null;
}

export async function saveRecipe(id: string | null, input: SaveRecipeInput) {
  if (!await recipeReferencesExist(input)) throw new InvalidRecipeIngredientReferenceError();
  const record = await saveRecipeRecord(id, input);
  return record ? presentRecipe(record) : null;
}

export async function deleteRecipe(id: string) {
  return deleteRecipeRecord(id);
}
