import type { db as dbClient } from '@/libs/DB';
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import { hashSetupToken } from '@/libs/setup-token';
import { account, accountSetupTokens, session, smsMessages, studentPlacements, user } from '@/models/Schema';

// Same structural-typing convention as reserveMatricule - accepts either the
// top-level db client or an open `tx`, whichever the caller already has.
type Tx = Pick<typeof dbClient, 'select' | 'update' | 'insert' | 'delete'> & {
  execute?: typeof dbClient.execute;
};

export type TransitionOptions = {
  effectiveDate?: string;
  notes?: string;
  actorBranchId?: string | null;
  allowIdempotent?: boolean;
};

export type TransitionResult = {
  studentId: string;
  tempPassword: string | null;
  loginAccessMethod: string;
  loginAccessDeliveryStatus: string | null;
  idempotent?: boolean;
};

// Canonical graduation transition (future-implementation/alumni-portal) -
// Authoritative lifecycle transition from active student to alumnus.
// Implements rules AL1 to AL15:
// - Concurrency locking per student (AL15)
// - Tenant and branch isolation (AL4, AL5)
// - Explicit lifecycle state validation (AL6)
// - Placement closure and history preservation (AL7, AL8, AL10, AL11, AL12)
// - Idempotent re-transition (AL2)
// - Preserves matricule/Massar (AL9)
// - Secure credential and access transition (AL13)
export async function transitionStudentToAlumni(
  tx: Tx,
  tenantId: string,
  studentId: string,
  actorUserId: string,
  graduationCohortSessionYearId?: string,
  options?: TransitionOptions,
): Promise<TransitionResult> {
  // AL15: Concurrency serialization per student
  if (typeof tx.execute === 'function') {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${studentId}`}, 0))`,
    );
  }

  // AL4: Tenant-scoped student lookup
  const [student] = await tx
    .select({
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      name: user.name,
      phone: user.phone,
      role: user.role,
      userStatus: user.userStatus,
      matricule: user.matricule,
      nationalId: user.nationalId,
    })
    .from(user)
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)))
    .limit(1);

  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Élève introuvable dans cet établissement.');
  }

  // AL5: Branch isolation where applicable
  if (options?.actorBranchId && student.branchId && student.branchId !== options.actorBranchId) {
    throw new ApiError(403, 'BRANCH_MISMATCH', 'Vous ne pouvez pas transitionner un élève d\'une autre annexe.');
  }

  const effectiveDate = options?.effectiveDate || new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  // AL2: Already alumni -> idempotent handling, ensure no active placements linger (AL8)
  if (student.role === 'alumni') {
    await tx
      .update(studentPlacements)
      .set({
        isCurrent: false,
        endDate: effectiveDate,
        status: 'graduated',
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.studentId, studentId),
          eq(studentPlacements.isCurrent, true),
        ),
      );

    return {
      studentId,
      tempPassword: null,
      loginAccessMethod: 'none',
      loginAccessDeliveryStatus: 'already_alumni',
      idempotent: true,
    };
  }

  // AL3: Non-students cannot be transitioned to alumni
  if (student.role !== 'student') {
    throw new ApiError(422, 'INVALID_ROLE', `Cet utilisateur a le rôle « ${student.role} » et ne peut pas être transitionné comme ancien élève.`);
  }

  // AL6: Student lifecycle state must be active
  if (student.userStatus !== 'active') {
    throw new ApiError(422, 'INVALID_LIFECYCLE_STATE', `L'élève doit être actif pour être diplômé (statut actuel : ${student.userStatus}).`);
  }

  // AL7: Transactionally query and close any currently active placement in studentPlacements
  const [currentPlacement] = await tx
    .select({
      id: studentPlacements.id,
      sessionYearId: studentPlacements.sessionYearId,
    })
    .from(studentPlacements)
    .where(
      and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.studentId, studentId),
        eq(studentPlacements.isCurrent, true),
      ),
    )
    .limit(1);

  if (currentPlacement) {
    await tx
      .update(studentPlacements)
      .set({
        isCurrent: false,
        endDate: effectiveDate,
        status: 'graduated',
        notes: options?.notes || 'Fin de scolarité / Diplômé (Transition vers Ancien élève)',
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(studentPlacements.id, currentPlacement.id),
          eq(studentPlacements.tenantId, tenantId),
        ),
      );
  }

  const cohortSessionYearId = graduationCohortSessionYearId ?? currentPlacement?.sessionYearId ?? null;

  // AL1 & AL9: Update user role to alumni while preserving matricule, Massar, and identity truth
  const [updated] = await tx
    .update(user)
    .set({
      role: 'alumni',
      alumniTransitionedAt: nowIso,
      alumniTransitionedBy: actorUserId,
      graduationCohortSessionYearId: cohortSessionYearId,
      updatedAt: nowIso,
    })
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
    .returning({ id: user.id, name: user.name, phone: user.phone });

  if (!updated) {
    throw new ApiError(409, 'NOT_TRANSITIONABLE', 'Cet utilisateur n\'est plus un élève actif (concurrence détectée).');
  }

  // AL13: Invalidate previous student credentials and sessions
  await tx.delete(account).where(and(eq(account.userId, studentId), eq(account.providerId, 'credential')));
  await tx.delete(session).where(eq(session.userId, studentId));

  // Issue new real alumni credentials based on security.loginAccessMethod
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

  return { studentId, tempPassword, loginAccessMethod, loginAccessDeliveryStatus, idempotent: false };
}
