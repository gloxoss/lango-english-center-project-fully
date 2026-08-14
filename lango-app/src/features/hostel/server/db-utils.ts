// Tiny helper: `.returning()` always yields exactly one row for a single-row
// INSERT/UPDATE, but under noUncheckedIndexedAccess the element type is
// `T | undefined`. Assert it so callers get a clean non-nullable row type.
import { ApiError } from '@/libs/api/errors';

export function firstRow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (!row) throw new ApiError(500, 'INTERNAL_ERROR', 'L\'opération n\'a produit aucun résultat.');
  return row;
}
