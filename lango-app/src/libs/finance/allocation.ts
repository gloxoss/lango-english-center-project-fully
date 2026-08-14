import { z } from 'zod';
import { moneyInput } from '@/libs/finance/validation';

// The immutable component snapshot stored on a published fee-structure version
// (see /api/finance/fee-structures/:id/versions). amount is a normalized
// decimal string ("1500.00") — moneyInput re-validates it as the billing source.
export const allocationComponentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  amount: moneyInput,
  recurrence: z.enum(['once', 'term', 'yearly']).default('once'),
  taxable: z.boolean().default(false),
  mandatory: z.boolean().default(true),
  dueOffsetDays: z.number().int().min(0).max(3650).default(0),
}).strict();

export type AllocationComponent = z.infer<typeof allocationComponentSchema>;

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
