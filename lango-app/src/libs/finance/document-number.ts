import { and, eq, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { namingSeries } from '@/models/Schema';

// Same advisory-lock + FOR UPDATE recipe as posting-service.ts:225-245, but on
// the shared naming_series table. currentVal holds the last issued value (0 = no
// row yet); the first consume emits `start`, then +step each time. Call inside
// the caller's transaction so the number is released/rolled back atomically.
type DocumentNumberClient = Pick<typeof db, 'execute' | 'select' | 'insert' | 'update'>;

export interface ConsumeDocumentNumberOptions {
  tenantId: string;
  prefix: string;
  start?: number;
  step?: number;
  padStart?: number;
}

export async function consumeDocumentNumber(
  client: DocumentNumberClient,
  { tenantId, prefix, start = 1, step = 1, padStart = 4 }: ConsumeDocumentNumberOptions,
): Promise<string> {
  await client.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:numbering:${prefix}`}, 0))`);
  await client.insert(namingSeries).values({ tenantId, prefix, currentVal: 0 }).onConflictDoNothing();

  const [series] = await client
    .select()
    .from(namingSeries)
    .where(and(eq(namingSeries.tenantId, tenantId), eq(namingSeries.prefix, prefix)))
    .for('update');
  if (!series) {
    throw new ApiError(500, 'NUMBERING_SERIES_MISSING', 'La séquence de numérotation est introuvable.');
  }

  const next = series.currentVal === 0 ? start : series.currentVal + step;
  await client
    .update(namingSeries)
    .set({ currentVal: next })
    .where(and(eq(namingSeries.tenantId, tenantId), eq(namingSeries.prefix, prefix)));

  return `${prefix}${String(next).padStart(padStart, '0')}`;
}
