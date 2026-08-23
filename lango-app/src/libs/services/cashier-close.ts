import { and, eq, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { tryPostCashierVarianceGLEntry } from '@/libs/finance/gl-auto-post';
import { cashierClosings, cashierSessions, payments } from '@/models/Schema';

/**
 * Close an open cashier session: compute collected cash live (posted cash
 * payments only — reversed/refunded payments no longer count toward the
 * drawer), snapshot a cashier_closings row, flip the session closed, and post
 * any variance to GL (fail-open). Shared by both close surfaces.
 */
export async function closeCashierSession(input: {
  tenantId: string;
  sessionId: string;
  actualCash: number;
  notes?: string;
  actorId: string;
}) {
  const { tenantId, sessionId, actualCash, notes, actorId } = input;

  const [session] = await db
    .select()
    .from(cashierSessions)
    .where(and(eq(cashierSessions.id, sessionId), eq(cashierSessions.tenantId, tenantId)))
    .limit(1);
  if (!session) {
    throw new ApiError(404, 'NOT_FOUND', 'Session de caisse introuvable.');
  }
  if (session.status !== 'open') {
    throw new ApiError(409, 'ALREADY_CLOSED', 'Cette session de caisse est déjà clôturée.');
  }

  const [cashSummary] = await db
    .select({ totalCash: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        eq(payments.receivedById, session.cashierId),
        eq(payments.paymentMethod, 'cash'),
        eq(payments.status, 'posted'),
        sql`${payments.createdAt} >= ${session.openedAt}`,
      ),
    );

  const totalCollected = Number(cashSummary?.totalCash ?? 0);
  const expectedCash = Number(session.startingFloat) + totalCollected;
  const variance = Number(actualCash.toFixed(2)) - Number(expectedCash.toFixed(2));

  const [closing] = await db
    .insert(cashierClosings)
    .values({
      tenantId,
      cashierSessionId: sessionId,
      cashierId: session.cashierId,
      expectedCash,
      actualCash,
      variance,
      notes: notes ?? null,
      closedById: actorId,
    })
    .returning();
  if (!closing) {
    throw new ApiError(500, 'CLOSING_INSERT_FAILED', 'Clôture non enregistrée.');
  }

  await db
    .update(cashierSessions)
    .set({ status: 'closed', closedAt: new Date().toISOString(), totalCollected, expectedCash, actualCash, notes: notes ?? null })
    .where(and(eq(cashierSessions.id, sessionId), eq(cashierSessions.tenantId, tenantId)));

  await tryPostCashierVarianceGLEntry({
    tenantId,
    actorId,
    cashierClosingId: closing.id,
    variance,
    closeDate: new Date().toISOString(),
  });

  return { closing, totalCollected, expectedCash, variance };
}

/** Post-close reconciliation step: mark a closed session reconciled. */
export async function reconcileCashierSession(input: {
  tenantId: string;
  id: string;
  actorId: string;
}) {
  const { tenantId, id, actorId } = input;

  const [session] = await db
    .select()
    .from(cashierSessions)
    .where(and(eq(cashierSessions.id, id), eq(cashierSessions.tenantId, tenantId)))
    .limit(1);
  if (!session) {
    throw new ApiError(404, 'NOT_FOUND', 'Session de caisse introuvable.');
  }
  if (session.status === 'open') {
    throw new ApiError(409, 'NOT_CLOSED', 'La session doit être clôturée avant rapprochement.');
  }
  if (session.status === 'reconciled') {
    throw new ApiError(409, 'ALREADY_RECONCILED', 'Cette session est déjà rapprochée.');
  }

  const [updated] = await db
    .update(cashierSessions)
    .set({ status: 'reconciled', reconciledById: actorId, reconciledAt: new Date().toISOString() })
    .where(and(eq(cashierSessions.id, id), eq(cashierSessions.tenantId, tenantId)))
    .returning();

  return updated;
}
