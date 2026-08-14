import { and, eq, sql } from 'drizzle-orm';
import type { db as dbClient } from '@/libs/DB';
import { namingSeries } from '@/models/Schema';

// Real, sequential VER-{year}-###### verification code via the same
// namingSeries mechanism as reserveMatricule, but with an advisory lock -
// a verification code is a security-relevant identifier (future-implementation
// /alumni-portal): a collision would let one document's code be mistaken for
// another's, unlike a matricule where that risk is accepted as low-stakes.
//
// Does NOT open its own transaction (matches reserveMatricule's convention) -
// callers that need the code reserved atomically together with their own
// insert (e.g. document issuance) pass their own open `tx`. IMPORTANT:
// pg_advisory_xact_lock is transaction-scoped - this function MUST always be
// called with an actual open `tx` (e.g. from `db.transaction(async (tx) => ...)`),
// never the bare top-level `db` client, or the lock provides no real
// protection (it would be acquired and released before the next statement).
export async function reserveVerificationCode(db: Pick<typeof dbClient, 'select' | 'update' | 'insert' | 'execute'>, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VER-${year}-`;

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
