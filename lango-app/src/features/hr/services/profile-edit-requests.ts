import { z } from 'zod';
const schema = z.object({ bankRib: z.string().trim().max(34).optional(), cnssNumber: z.string().trim().max(50).optional(), amoNumber: z.string().trim().max(50).optional() }).strict();
export function parseSensitiveProfileChanges(value: unknown) {
  const parsed = schema.parse(value);
  if (Object.keys(parsed).length === 0) throw new z.ZodError([]);
  return parsed;
}
