import { z } from 'zod';
import { moneyToCents } from '@/libs/finance/money';

// A positive money amount: accepts a numeric string or a JS number, and
// normalizes to a decimal string (e.g. "1234.56"). Shared by every finance
// write path so float arithmetic never enters the ledger.
export const moneyInput = z.union([
  z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/),
  z.number().positive().finite().transform(value => value.toFixed(2)),
]).refine(value => moneyToCents(value) > BigInt(0));
