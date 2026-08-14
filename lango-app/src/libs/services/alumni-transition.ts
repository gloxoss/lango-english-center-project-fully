import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import type { db as dbClient } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { hashSetupToken } from '@/libs/setup-token';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import { account, accountSetupTokens, session, smsMessages, user } from '@/models/Schema';

// Same structural-typing convention as reserveMatricule - accepts either the
// top-level db client or an open `tx`, whichever the caller already has.
type Tx = Pick<typeof dbClient, 'select' | 'update' | 'insert' | 'delete'>;

export type TransitionResult = {
  studentId: string;
  tempPassword: string | null;
  loginAccessMethod: string;
  loginAccessDeliveryStatus: string | null;
};

// Real graduation transition (future-implementation/alumni-portal) - the
// first code path in this app that ever changes a user's role after
// creation. Shared by the single-student and bulk-transition routes so
// there is exactly one real implementation, matching this session's
// established shared-helper-extraction discipline (see reserveMatricule).
export async function transitionStudentToAlumni(
  tx: Tx,
  tenantId: string,
  studentId: string,
  actorUserId: string,
  graduationCohortSessionYearId?: string,
): Promise<TransitionResult> {
  // Real WHERE-clause guard: the UPDATE only affects a row still in
  // role='student' for this tenant, so a concurrent double-transition
  // naturally loses instead of racing - checked via the returned row count.
  const [updated] = await tx
    .update(user)
    .set({
      role: 'alumni',
      alumniTransitionedAt: new Date().toISOString(),
      alumniTransitionedBy: actorUserId,
      graduationCohortSessionYearId: graduationCohortSessionYearId ?? null,
    })
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
    .returning({ id: user.id, name: user.name, phone: user.phone });

  if (!updated) {
    throw new ApiError(409, 'NOT_TRANSITIONABLE', 'Cet utilisateur n\'est pas un élève actif pour cet établissement (déjà transitionné ou introuvable).');
  }

  // Kill old credentials AND any already-active session - a password change
  // alone would leave an already-logged-in student session working.
  await tx.delete(account).where(and(eq(account.userId, studentId), eq(account.providerId, 'credential')));
  await tx.delete(session).where(eq(session.userId, studentId));

  // Issue new real alumni credentials, same branch-on-loginAccessMethod
  // logic as the admission-approval transaction. Resolved via the settings
  // registry with a legacy schoolSettings fallback.
  const { value: loginAccessMethodValue } = await getEffectiveValueWithLegacyFallback(tenantId, null, 'security.loginAccessMethod');
  const loginAccessMethod = (loginAccessMethodValue as string) || 'invite_link';

  let tempPassword: string | null = null;
  let loginAccessDeliveryStatus: string | null = null;

  if (loginAccessMethod === 'temp_password') {
    tempPassword = randomBytes(9).toString('base64url');
    const hashed = await hashPassword(tempPassword);
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: studentId,
      providerId: 'credential',
      userId: studentId,
      password: hashed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await tx.insert(accountSetupTokens).values({
      tenantId,
      userId: studentId,
      token: hashSetupToken(token),
      expiresAt,
    });

    // Alumni are the self-service user now, not a guardian - send to their
    // own real phone, not a guardian's (unlike the admission-approval flow).
    if (updated.phone) {
      await tx.insert(smsMessages).values({
        tenantId,
        recipientPhone: updated.phone,
        studentId,
        body: `Bienvenue dans le portail Anciens Élèves ! Activez votre compte via ce lien : /setup-account?token=${token}`,
        status: 'sent',
        sentAt: new Date().toISOString(),
        createdById: actorUserId,
      });
      loginAccessDeliveryStatus = 'sent';
    } else {
      loginAccessDeliveryStatus = 'no_phone';
    }
  }

  return { studentId, tempPassword, loginAccessMethod, loginAccessDeliveryStatus };
}
