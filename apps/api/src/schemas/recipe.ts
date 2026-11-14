import { z } from 'zod';

const pagination = {
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const ingredientQuantity = z.number()
  .finite()
  .positive()
  .max(999_999_999.999)
  .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001);

const recipeIngredientSchema = z.object({
  groceryItemId: z.string().uuid(),
  unitId: z.string().uuid(),
  quantity: ingredientQuantity,
}).strict();

export const recipeIdSchema = z.string().uuid();

export const recipeCategories = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'drinks',
  'other',
] as const;

export const recipeCategorySchema = z.enum(recipeCategories);

export const recipeListQuerySchema = z.object({
  ...pagination,
  search: z.string().trim().min(1).max(120).optional(),
  category: z.union([recipeCategorySchema, z.literal('uncategorized')]).optional(),
}).strict();

export const saveRecipeSchema = z.object({
  name: z.string().trim().min(1).max(120).transform((value) => value.replace(/\s+/g, ' ')),
  servings: z.number().int().min(1).max(1000),
  category: recipeCategorySchema.nullable().optional().transform((value) => value ?? null),
  instructions: z.string().trim().max(5000).nullable().optional().transform((value) => value || null),
  ingredients: z.array(recipeIngredientSchema).min(1).max(100),
}).strict().superRefine((recipe, context) => {
  const seen = new Set<string>();
  recipe.ingredients.forEach((ingredient, index) => {
    const key = `${ingredient.groceryItemId}:${ingredient.unitId}`;
    if (seen.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ingredients', index],
        message: 'Each grocery item and unit can only appear once in a recipe.',
      });
    }
    seen.add(key);
  });
});

export type RecipeListQuery = z.infer<typeof recipeListQuerySchema>;
export type SaveRecipeInput = z.infer<typeof saveRecipeSchema>;
