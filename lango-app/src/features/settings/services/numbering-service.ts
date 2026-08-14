import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  numberingSeriesDefinitions,
  numberingSeriesVersions,
} from '@/features/settings/models/settings-schema';

// ---------------------------------------------------------------------------
// Numbering series registry. A series produces sequential, zero-padded
// document numbers (invoices, matricules) with an optional prefix/suffix.
// Consumption is serialized per series with a transaction-level advisory lock
// + SELECT ... FOR UPDATE so two concurrent callers can never receive the same
// number (same pattern as accounting posting-service).
// ---------------------------------------------------------------------------

export const numberingSeriesInputSchema = z.object({
  key: z.string().trim().min(1).max(128).regex(/^[a-z0-9][a-z0-9._-]*$/i, 'Clé invalide (lettres, chiffres, . _ -)'),
  name: z.string().trim().min(1).max(255),
  prefix: z.string().max(50).optional().nullable(),
  suffix: z.string().max(50).optional().nullable(),
  padding: z.number().int().min(0).max(12).default(0),
  start: z.number().int().min(1).default(1),
  step: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
}).strict();

export type NumberingSeriesInput = z.input<typeof numberingSeriesInputSchema>;

function formatNumber(series: typeof numberingSeriesDefinitions.$inferSelect, value: number): string {
  return `${series.prefix ?? ''}${String(value).padStart(series.padding, '0')}${series.suffix ?? ''}`;
}

/** The next value a series would emit without consuming it. */
function computeNext(series: typeof numberingSeriesDefinitions.$inferSelect): number {
  return series.current === 0 ? series.start : series.current + series.step;
}

async function requireSeries(tenantId: string, id: string) {
  const [series] = await db
    .select()
    .from(numberingSeriesDefinitions)
    .where(and(
      eq(numberingSeriesDefinitions.tenantId, tenantId),
      eq(numberingSeriesDefinitions.id, id),
    ))
    .limit(1);
  if (!series) {
    throw new ApiError(404, 'NUMBERING_SERIES_NOT_FOUND', 'Série de numérotation introuvable.');
  }
  return series;
}

export async function listNumberingSeries(tenantId: string) {
  return db
    .select()
    .from(numberingSeriesDefinitions)
    .where(eq(numberingSeriesDefinitions.tenantId, tenantId))
    .orderBy(numberingSeriesDefinitions.createdAt);
}

export async function getNumberingSeries(context: RequestContext, id: string) {
  const tenantId = requireTenant(context);
  const series = await requireSeries(tenantId, id);
  return { ...series, nextValue: formatNumber(series, computeNext(series)) };
}

export async function createNumberingSeries(context: RequestContext, input: NumberingSeriesInput) {
  const tenantId = requireTenant(context);
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(numberingSeriesDefinitions).values({
      tenantId,
      ...input,
      current: 0,
    }).returning();
    if (!row) throw new ApiError(500, 'NUMBERING_CREATE_FAILED', 'Impossible de créer la série.');
    await tx.insert(numberingSeriesVersions).values({
      tenantId,
      seriesId: row.id,
      version: 1,
      prefix: row.prefix,
      suffix: row.suffix,
      padding: row.padding,
      start: row.start,
      current: 0,
      step: row.step,
      actorId: context.userId,
      reason: 'Création de la série',
    });
    return row;
  });
  return { ...created, nextValue: formatNumber(created, computeNext(created)) };
}

export async function updateNumberingSeries(
  context: RequestContext,
  id: string,
  input: Partial<NumberingSeriesInput>,
) {
  const tenantId = requireTenant(context);
  await requireSeries(tenantId, id);

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(numberingSeriesDefinitions)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(and(
        eq(numberingSeriesDefinitions.tenantId, tenantId),
        eq(numberingSeriesDefinitions.id, id),
      ))
      .returning();
    if (!row) throw new ApiError(404, 'NUMBERING_SERIES_NOT_FOUND', 'Série de numérotation introuvable.');
    const [latest] = await tx.select({ v: numberingSeriesVersions.version })
      .from(numberingSeriesVersions)
      .where(eq(numberingSeriesVersions.seriesId, row.id))
      .orderBy(desc(numberingSeriesVersions.version))
      .limit(1);
    await tx.insert(numberingSeriesVersions).values({
      tenantId,
      seriesId: row.id,
      version: (latest?.v ?? 0) + 1,
      prefix: row.prefix,
      suffix: row.suffix,
      padding: row.padding,
      start: row.start,
      current: row.current,
      step: row.step,
      actorId: context.userId,
      reason: 'Mise à jour de la série',
    });
    return row;
  });

  return { ...updated, nextValue: formatNumber(updated, computeNext(updated)) };
}

/** Compute the next number without consuming the sequence. */
export async function previewNextNumber(context: RequestContext, id: string) {
  const tenantId = requireTenant(context);
  const series = await requireSeries(tenantId, id);
  const nextValue = computeNext(series);
  return {
    seriesId: series.id,
    key: series.key,
    nextValue: formatNumber(series, nextValue),
    numericValue: nextValue,
    current: series.current,
  };
}

/**
 * Consume the next number. Serialized per series with an advisory lock + FOR
 * UPDATE; the consumed value is committed before returning, so concurrent
 * callers always receive distinct numbers.
 */
export async function consumeNextNumber(context: RequestContext, id: string) {
  const tenantId = requireTenant(context);
  const consumed = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:numbering:${id}`}, 0))`);
    const [series] = await tx.select()
      .from(numberingSeriesDefinitions)
      .where(and(
        eq(numberingSeriesDefinitions.tenantId, tenantId),
        eq(numberingSeriesDefinitions.id, id),
      ))
      .for('update')
      .limit(1);
    if (!series) throw new ApiError(404, 'NUMBERING_SERIES_NOT_FOUND', 'Série de numérotation introuvable.');
    if (!series.isActive) throw new ApiError(409, 'NUMBERING_SERIES_INACTIVE', 'Cette série de numérotation est désactivée.');

    const nextValue = computeNext(series);
    const formatted = formatNumber(series, nextValue);
    await tx.update(numberingSeriesDefinitions)
      .set({ current: nextValue, updatedAt: new Date().toISOString() })
      .where(eq(numberingSeriesDefinitions.id, series.id));
    return { seriesId: series.id, key: series.key, nextValue: formatted, numericValue: nextValue };
  });
  return consumed;
}
