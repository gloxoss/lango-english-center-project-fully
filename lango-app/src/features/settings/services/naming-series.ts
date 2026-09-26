import { and, eq, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { namingSeries } from '@/models/Schema';

/**
 * The tenant's REAL document counters (OD3).
 *
 * `naming_series` is what `reserveMatricule` and `consumeDocumentNumber`
 * actually increment, so it is the only honest source for "what number comes
 * next". The Numbering page used to edit `numbering_series_definitions`, a
 * second store nothing consumed: a director could renumber the page all day and
 * the next invoice would not change. That page now reads and raises these rows
 * and the definitions system is no longer linked (it is kept, not deleted).
 *
 * A series is identified by its PREFIX, which is the primary key together with
 * the tenant. There is no separate id to invent.
 */

/** What a prefix is FOR. The client turns this into a localized label. */
export type NamingSeriesKind =
  | 'invoice'
  | 'receipt'
  | 'credit_note'
  | 'candidate'
  | 'employee'
  | 'student_matricule'
  | 'other';

export type NamingSeriesRow = {
  prefix: string;
  currentVal: number;
  kind: NamingSeriesKind;
  nextNumber: string;
};

/** Pad width used by both consumers of this table. */
const PAD = 4;

/**
 * Classify a prefix. Order matters, because both real document codes and
 * school matricule prefixes carry the year (`INV-2026-`, `ATL-2526-`): the
 * KNOWN document codes are tested first, so `INV-2026-` is an invoice and a
 * school code is only considered a matricule when no document code matches.
 * The trailing dash is optional because imported matricules exist as
 * `ATL-2526` (no separator).
 */
export function namingSeriesKind(prefix: string): NamingSeriesKind {
  if (prefix.startsWith('INV')) {
    return 'invoice';
  }
  if (prefix.startsWith('RC')) {
    return 'receipt';
  }
  if (prefix.startsWith('CN')) {
    return 'credit_note';
  }
  if (prefix.startsWith('CAND')) {
    return 'candidate';
  }
  if (prefix.startsWith('EMP')) {
    return 'employee';
  }
  // Refund numbers (`RF-{year}-`) carry the year but have no dedicated kind:
  // 'other' keeps them out of the matricule bucket.
  if (prefix.startsWith('RF')) {
    return 'other';
  }
  if (/^[A-Z0-9]{2,10}-\d{4}-?$/.test(prefix) || prefix.startsWith('STD-')) {
    return 'student_matricule';
  }
  return 'other';
}

/** The number this series would emit next, without consuming it. */
export function nextNumberFor(prefix: string, currentVal: number): string {
  const next = currentVal <= 0 ? 1 : currentVal + 1;
  return `${prefix}${String(next).padStart(PAD, '0')}`;
}

export async function listNamingSeries(tenantId: string): Promise<NamingSeriesRow[]> {
  const rows = await db
    .select()
    .from(namingSeries)
    .where(eq(namingSeries.tenantId, tenantId))
    .orderBy(namingSeries.prefix);

  return rows.map(row => ({
    prefix: row.prefix,
    currentVal: row.currentVal,
    kind: namingSeriesKind(row.prefix),
    nextNumber: nextNumberFor(row.prefix, row.currentVal),
  }));
}

export async function getNamingSeries(tenantId: string, prefix: string): Promise<NamingSeriesRow> {
  const [row] = await db
    .select()
    .from(namingSeries)
    .where(and(eq(namingSeries.tenantId, tenantId), eq(namingSeries.prefix, prefix)))
    .limit(1);

  if (!row) {
    // Cross-tenant prefixes are indistinguishable from unknown ones on purpose.
    throw new ApiError(404, 'NAMING_SERIES_NOT_FOUND', 'Série de numérotation introuvable.');
  }

  return {
    prefix: row.prefix,
    currentVal: row.currentVal,
    kind: namingSeriesKind(row.prefix),
    nextNumber: nextNumberFor(row.prefix, row.currentVal),
  };
}

/**
 * Raise a counter to `currentVal`. Never lowers it.
 *
 * Lowering is refused rather than clamped because it is not a "smaller value",
 * it is a request to re-issue numbers that are already printed on invoices and
 * matricules. Refusing is also what makes this endpoint safe to expose: the
 * worst a mistake can do is skip numbers.
 *
 * Concurrency: `reserveMatricule` and `consumeDocumentNumber` serialize on an
 * advisory lock keyed by tenant+prefix and then take the row FOR UPDATE. This
 * takes BOTH advisory keys (the two callers use different key strings, so one
 * lock would not cover the other) and then the same row lock, so a raise that
 * races a reservation can never hand out a number that was just raised past.
 */
export async function raiseNamingSeries(
  tenantId: string,
  prefix: string,
  currentVal: number,
): Promise<{ before: number; after: number; row: NamingSeriesRow }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:naming_series:${prefix}`}, 0))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:numbering:${prefix}`}, 0))`);

    const [series] = await tx
      .select()
      .from(namingSeries)
      .where(and(eq(namingSeries.tenantId, tenantId), eq(namingSeries.prefix, prefix)))
      .for('update');

    if (!series) {
      throw new ApiError(404, 'NAMING_SERIES_NOT_FOUND', 'Série de numérotation introuvable.');
    }

    if (currentVal < series.currentVal) {
      throw new ApiError(
        409,
        'CANNOT_LOWER_SERIES',
        `La valeur ne peut pas être abaissée : des documents ont déjà été émis jusqu'à ${series.currentVal}.`,
        { currentVal: series.currentVal, requested: currentVal },
      );
    }

    // Equal is a no-op: writing the same value would create a settings version
    // with no change in it.
    if (currentVal === series.currentVal) {
      return {
        before: series.currentVal,
        after: series.currentVal,
        row: {
          prefix,
          currentVal: series.currentVal,
          kind: namingSeriesKind(prefix),
          nextNumber: nextNumberFor(prefix, series.currentVal),
        },
      };
    }

    await tx
      .update(namingSeries)
      .set({ currentVal })
      .where(and(eq(namingSeries.tenantId, tenantId), eq(namingSeries.prefix, prefix)));

    return {
      before: series.currentVal,
      after: currentVal,
      row: {
        prefix,
        currentVal,
        kind: namingSeriesKind(prefix),
        nextNumber: nextNumberFor(prefix, currentVal),
      },
    };
  });
}
