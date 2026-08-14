// Tenant-scoped reference number reservation for inventory documents
// (PUR-/SAL-/ISS-/ADJ-/TRF-{year}-######). Same shape as reserveVerificationCode:
// a pg_advisory_xact_lock keyed on {tenantId}:{prefix} serializes the
// naming_series bump per tenant inside the caller's open transaction.
//
// naming_series is keyed by `prefix` only (a single global row per prefix, as
// with STD-/EMP-). Uniqueness of the final number is enforced tenant-scoped by
// unique(tenant_id, <doc>_number) on each document table, so a shared counter
// may increment across tenants but can never produce a same-tenant duplicate
// (the advisory lock serializes the read-modify-write within a tenant).
//
// IMPORTANT: the advisory lock is transaction-scoped — this MUST run inside a
// real open `tx` (db.transaction), never the bare top-level `db`.
import { and, eq, sql } from 'drizzle-orm';
import type { db as dbClient } from '@/libs/DB';
import { namingSeries } from '@/models/Schema';

export async function reserveInventoryNumber(
  db: Pick<typeof dbClient, 'select' | 'update' | 'insert' | 'execute'>,
  tenantId: string,
  code: 'PUR' | 'SAL' | 'ISS' | 'ADJ' | 'TRF',
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${code}-${year}-`;

  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${prefix}`}, 0))`);

  const [series] = await db
    .select()
    .from(namingSeries)
    .where(and(eq(namingSeries.prefix, prefix), eq(namingSeries.tenantId, tenantId)))
    .limit(1);

  let currentVal = 1;
  if (series) {
    currentVal = series.currentVal + 1;
    await db.update(namingSeries).set({ currentVal }).where(and(eq(namingSeries.prefix, prefix), eq(namingSeries.tenantId, tenantId)));
  } else {
    await db.insert(namingSeries).values({ prefix, tenantId, currentVal: 1 });
  }

  return `${prefix}${String(currentVal).padStart(6, '0')}`;
}
