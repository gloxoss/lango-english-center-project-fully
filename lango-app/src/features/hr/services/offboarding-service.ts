import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { employeeProfiles, user } from '@/models/Schema';
import { employeeEmploymentEvents } from '@/features/hr/models/hr-schema';
import { getEmployee } from './employees-service';

// Offboarding deactivates a linked account's login access while retaining all
// historical records (employment events, payroll, leave, documents). The
// profile itself is never deleted; `employmentStatus` moves to 'offboarded'
// and, when a user account is linked, its `userStatus` flips to 'inactive'.

export async function offboardEmployee(tenantId: string, actorId: string, employeeId: string, reason?: string | null) {
  const existing = await getEmployee(tenantId, employeeId, true);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');
  if (existing.employmentStatus === 'offboarded') {
    throw new ApiError(409, 'ALREADY_OFFBOARDED', 'Cet employé est déjà sorti.');
  }

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .update(employeeProfiles)
      .set({ employmentStatus: 'offboarded', updatedAt: new Date().toISOString() })
      .where(and(eq(employeeProfiles.id, employeeId), eq(employeeProfiles.tenantId, tenantId)))
      .returning();

    if (existing.userId) {
      await tx.update(user)
        .set({ userStatus: 'inactive', updatedAt: new Date().toISOString() })
        .where(and(eq(user.id, existing.userId), eq(user.tenantId, tenantId)));
    }

    await tx.insert(employeeEmploymentEvents).values({
      tenantId,
      employeeId,
      eventType: 'offboarded',
      actorId,
      reason: reason ?? null,
      metadata: { linkedAccountDisabled: Boolean(existing.userId) },
      effectiveAt: new Date().toISOString(),
    });

    return row;
  });
}

export async function reactivateEmployee(tenantId: string, actorId: string, employeeId: string, reason?: string | null) {
  const existing = await getEmployee(tenantId, employeeId, true);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');
  if (existing.employmentStatus !== 'offboarded') {
    throw new ApiError(409, 'NOT_OFFBOARDED', 'Seul un employé sorti peut être réactivé.');
  }

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .update(employeeProfiles)
      .set({ employmentStatus: 'active', updatedAt: new Date().toISOString() })
      .where(and(eq(employeeProfiles.id, employeeId), eq(employeeProfiles.tenantId, tenantId)))
      .returning();

    if (existing.userId) {
      await tx.update(user)
        .set({ userStatus: 'active', updatedAt: new Date().toISOString() })
        .where(and(eq(user.id, existing.userId), eq(user.tenantId, tenantId)));
    }

    await tx.insert(employeeEmploymentEvents).values({
      tenantId,
      employeeId,
      eventType: 'reactivated',
      actorId,
      reason: reason ?? null,
      effectiveAt: new Date().toISOString(),
    });

    return row;
  });
}

export async function linkAccount(tenantId: string, actorId: string, employeeId: string, targetUserId: string) {
  const existing = await getEmployee(tenantId, employeeId, true);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');
  if (existing.userId) {
    throw new ApiError(409, 'ALREADY_LINKED', 'Cet employé est déjà lié à un compte utilisateur.');
  }

  const [targetUser] = await db.select().from(user)
    .where(and(eq(user.id, targetUserId), eq(user.tenantId, tenantId))).limit(1);
  if (!targetUser) throw new ApiError(422, 'INVALID_USER', 'Le compte utilisateur cible n\'existe pas dans cet établissement.');

  const [alreadyLinked] = await db.select({ id: employeeProfiles.id }).from(employeeProfiles)
    .where(and(
      eq(employeeProfiles.userId, targetUserId),
      eq(employeeProfiles.tenantId, tenantId),
      // exclude self so the `unique(tenantId, userId)` guard gives a clean 409
      // instead of a raw constraint violation when the same user is re-linked.
    )).limit(1);
  if (alreadyLinked) {
    throw new ApiError(409, 'USER_ALREADY_LINKED', 'Ce compte utilisateur est déjà lié à un autre employé.');
  }

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .update(employeeProfiles)
      .set({ userId: targetUserId, updatedAt: new Date().toISOString() })
      .where(and(eq(employeeProfiles.id, employeeId), eq(employeeProfiles.tenantId, tenantId)))
      .returning();

    // Mirror the HR profile's identity/contact/sensitive values onto the user
    // account (same direction as createEmployee) — only populated fields.
    const userUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (existing.firstName || existing.lastName) {
      userUpdates.name = `${existing.firstName ?? ''} ${existing.lastName ?? ''}`.trim();
    }
    if (existing.firstName) userUpdates.firstName = existing.firstName;
    if (existing.lastName) userUpdates.lastName = existing.lastName;
    if (existing.phone) userUpdates.phone = existing.phone;
    if (existing.photoUrl) userUpdates.photoUrl = existing.photoUrl;
    if (existing.nationalId) userUpdates.nationalId = existing.nationalId;
    if (existing.salary) userUpdates.salary = existing.salary;
    await tx.update(user).set(userUpdates)
      .where(and(eq(user.id, targetUserId), eq(user.tenantId, tenantId)));

    await tx.insert(employeeEmploymentEvents).values({
      tenantId,
      employeeId,
      eventType: 'linked_account',
      actorId,
      metadata: { userId: targetUserId },
      effectiveAt: new Date().toISOString(),
    });

    return row;
  });
}
