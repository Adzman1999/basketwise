import { z } from 'zod';

export const createUnitSchema = z.object({
  name: z.string().trim().min(1).max(32).transform((value) => value.replace(/\s+/g, ' ')),
}).strict();

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
