// Leave / return passes — supervision workflow. A pass records a resident's
// authorized departure and expected return. Warden approval is always required;
// guardian approval additionally if the tenant policy says so for minors. A
// return is recorded once (unique tenant+pass) and flips the pass to `returned`.
// Statuses: pending -> approved -> returned (denied/cancelled are terminal).
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { guardianStudents, guardians, user } from '@/models/Schema';
import {
  hostelAllocations,
  hostelBeds,
  hostelLeavePassApprovals,
  hostelLeavePassReturns,
  hostelLeavePasses,
  hostelRooms,
} from '@/features/hostel/models/hostel-schema';
import { firstRow } from '@/features/hostel/server/db-utils';
import { getPolicies } from '@/features/hostel/services/policies-service';
import { getStudentContext } from '@/features/hostel/services/eligibility-service';

function ageOn(dob: string | null, today: string): number | null {
  if (!dob) return null;
  const b = new Date(`${dob}T00:00:00`);
  const t = new Date(`${today}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age -= 1;
  return age;
}

export async function isMinor(tenantId: string, studentId: string): Promise<boolean> {
  const { policies } = await getPolicies(tenantId);
  const { student } = await getStudentContext(tenantId, studentId);
  const age = ageOn(student.dateOfBirth, new Date().toISOString().slice(0, 10));
  return age !== null && age < policies.majorityAge;
}

export async function createLeavePass(tenantId: string, actorId: string, opts: {
  allocationId: string;
  destination?: string | null;
  reason?: string | null;
  startDateTime: string;
  expectedReturnAt: string;
}) {
  const [allocation] = await db.select().from(hostelAllocations)
    .where(and(eq(hostelAllocations.id, opts.allocationId), eq(hostelAllocations.tenantId, tenantId))).limit(1);
  if (!allocation) throw new ApiError(404, 'NOT_FOUND', 'Affectation introuvable.');
  if (allocation.state !== 'reserved' && allocation.state !== 'checked_in') {
    throw new ApiError(409, 'INVALID_STATE', 'Seul un résident actuel (arrivée enregistrée ou réservée) peut bénéficier d\'une permission de sortie.');
  }
  if (!(new Date(opts.expectedReturnAt) > new Date(opts.startDateTime))) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Le retour prévu doit être postérieur au départ.');
  }

  const { policies } = await getPolicies(tenantId);
  if (policies.leavePassRequiresReason && !opts.reason?.trim()) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Un motif est obligatoire pour une permission de sortie.');
  }
  if (policies.leavePassRequiresDestination && !opts.destination?.trim()) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Une destination est obligatoire pour une permission de sortie.');
  }
  const durationHours = (new Date(opts.expectedReturnAt).getTime() - new Date(opts.startDateTime).getTime()) / 3_600_000;
  if (durationHours > policies.leavePassMaxHours) {
    throw new ApiError(422, 'LEAVE_TOO_LONG', `La sortie dépasse le maximum autorisé de ${policies.leavePassMaxHours} h.`);
  }

  const minor = await isMinor(tenantId, allocation.studentId);
  const guardianApprovalRequired = policies.guardianConsentRequiredForLeave && minor;

  const row = firstRow(await db.insert(hostelLeavePasses).values({
    tenantId,
    allocationId: allocation.id,
    studentId: allocation.studentId,
    destination: opts.destination ?? null,
    reason: opts.reason ?? null,
    startDateTime: opts.startDateTime,
    expectedReturnAt: opts.expectedReturnAt,
    guardianApprovalRequired,
    status: 'pending',
    createdById: actorId,
  }).returning());
  return row;
}

export async function decideLeavePass(tenantId: string, actorId: string, leavePassId: string, opts: {
  decision: 'approved' | 'denied';
  approverRole: 'warden' | 'guardian' | 'school_admin';
  reason?: string | null;
}) {
  const [prePass] = await db.select({ id: hostelLeavePasses.id, studentId: hostelLeavePasses.studentId })
    .from(hostelLeavePasses)
    .where(and(eq(hostelLeavePasses.id, leavePassId), eq(hostelLeavePasses.tenantId, tenantId))).limit(1);
  if (!prePass) throw new ApiError(404, 'NOT_FOUND', 'Permission de sortie introuvable.');

  // Guardian decisions are only valid from a verified guardian of the student.
  if (opts.approverRole === 'guardian') {
    const [guardian] = await db.select().from(guardians)
      .where(and(eq(guardians.tenantId, tenantId), eq(guardians.userId, actorId))).limit(1);
    if (!guardian) throw new ApiError(403, 'FORBIDDEN', 'Votre compte n\'est pas lié à un profil tuteur.');
    const [link] = await db.select().from(guardianStudents)
      .where(and(eq(guardianStudents.guardianId, guardian.id), eq(guardianStudents.studentId, prePass.studentId))).limit(1);
    if (!link) throw new ApiError(403, 'FORBIDDEN', 'Ce tuteur n\'est pas lié à cet élève.');
  }

  // Decision + approvals + state flip are one transaction. The pass row is
  // locked `.for('update')`, so concurrent decisions serialize: the loser
  // re-reads a non-pending state under the lock and is rejected ALREADY_DECIDED
  // instead of double-approving.
  return await db.transaction(async (tx) => {
    const [pass] = await tx.select().from(hostelLeavePasses)
      .where(and(eq(hostelLeavePasses.id, leavePassId), eq(hostelLeavePasses.tenantId, tenantId)))
      .for('update')
      .limit(1);
    if (!pass) throw new ApiError(404, 'NOT_FOUND', 'Permission de sortie introuvable.');
    if (pass.status !== 'pending') {
      throw new ApiError(409, 'ALREADY_DECIDED', 'Cette permission a déjà été décidée.');
    }

    await tx.insert(hostelLeavePassApprovals).values({
      tenantId,
      leavePassId: pass.id,
      approverId: actorId,
      approverRole: opts.approverRole,
      decision: opts.decision,
      reason: opts.reason ?? null,
    });

    if (opts.decision === 'denied') {
      return firstRow(await tx.update(hostelLeavePasses)
        .set({ status: 'denied', updatedAt: new Date().toISOString() })
        .where(and(eq(hostelLeavePasses.id, leavePassId), eq(hostelLeavePasses.tenantId, tenantId)))
        .returning());
    }

    // Approved: satisfied when warden (or school_admin) has approved, and the
    // guardian too when required for this pass.
    const approvals = await tx.select({ approverRole: hostelLeavePassApprovals.approverRole })
      .from(hostelLeavePassApprovals)
      .where(and(
        eq(hostelLeavePassApprovals.leavePassId, pass.id),
        eq(hostelLeavePassApprovals.tenantId, tenantId),
        eq(hostelLeavePassApprovals.decision, 'approved'),
      ));
    const roles = new Set(approvals.map(a => a.approverRole));
    const wardenOk = roles.has('warden') || roles.has('school_admin');
    const guardianOk = !pass.guardianApprovalRequired || roles.has('guardian');

    if (!wardenOk || !guardianOk) {
      return pass; // still pending, waiting on the remaining approver
    }
    return firstRow(await tx.update(hostelLeavePasses)
      .set({ status: 'approved', updatedAt: new Date().toISOString() })
      .where(and(eq(hostelLeavePasses.id, leavePassId), eq(hostelLeavePasses.tenantId, tenantId)))
      .returning());
  });
}

export async function recordReturn(tenantId: string, actorId: string, leavePassId: string, opts: { note?: string | null } = {}) {
  const [pass] = await db.select().from(hostelLeavePasses)
    .where(and(eq(hostelLeavePasses.id, leavePassId), eq(hostelLeavePasses.tenantId, tenantId))).limit(1);
  if (!pass) throw new ApiError(404, 'NOT_FOUND', 'Permission de sortie introuvable.');
  if (pass.status !== 'approved') {
    if (pass.status === 'returned') return pass; // idempotent retry of a recorded return
    throw new ApiError(409, 'INVALID_STATE', 'Seule une permission approuvée peut être enregistrée comme retour.');
  }

  // Unique (tenant, leave_pass_id) makes the return row insert idempotent; the
  // state flip is conditional on still being approved so a concurrent return
  // cannot double-record.
  await db.insert(hostelLeavePassReturns).values({
    tenantId,
    leavePassId: pass.id,
    allocationId: pass.allocationId,
    returnedAt: new Date().toISOString(),
    recordedById: actorId,
    note: opts.note ?? null,
  }).onConflictDoNothing();

  const [updated] = await db.update(hostelLeavePasses)
    .set({ actualReturnAt: new Date().toISOString(), status: 'returned', updatedAt: new Date().toISOString() })
    .where(and(
      eq(hostelLeavePasses.id, leavePassId),
      eq(hostelLeavePasses.tenantId, tenantId),
      eq(hostelLeavePasses.status, 'approved'),
    ))
    .returning();
  return updated ?? pass;
}

export async function listLeavePasses(tenantId: string, opts?: {
  hostelId?: string | null;
  allocationId?: string | null;
  studentId?: string | null;
  status?: string | null;
}) {
  const conds = [eq(hostelLeavePasses.tenantId, tenantId)];
  if (opts?.hostelId) conds.push(eq(hostelRooms.hostelId, opts.hostelId));
  if (opts?.allocationId) conds.push(eq(hostelLeavePasses.allocationId, opts.allocationId));
  if (opts?.studentId) conds.push(eq(hostelLeavePasses.studentId, opts.studentId));
  if (opts?.status) conds.push(eq(hostelLeavePasses.status, opts.status));

  return db
    .select({
      id: hostelLeavePasses.id,
      allocationId: hostelLeavePasses.allocationId,
      studentId: hostelLeavePasses.studentId,
      studentName: user.name,
      destination: hostelLeavePasses.destination,
      reason: hostelLeavePasses.reason,
      startDateTime: hostelLeavePasses.startDateTime,
      expectedReturnAt: hostelLeavePasses.expectedReturnAt,
      actualReturnAt: hostelLeavePasses.actualReturnAt,
      guardianApprovalRequired: hostelLeavePasses.guardianApprovalRequired,
      status: hostelLeavePasses.status,
      createdById: hostelLeavePasses.createdById,
      createdAt: hostelLeavePasses.createdAt,
      updatedAt: hostelLeavePasses.updatedAt,
      bedCode: hostelBeds.code,
      roomCode: hostelRooms.code,
    })
    .from(hostelLeavePasses)
    .innerJoin(hostelAllocations, eq(hostelLeavePasses.allocationId, hostelAllocations.id))
    .innerJoin(hostelBeds, eq(hostelAllocations.bedId, hostelBeds.id))
    .innerJoin(hostelRooms, eq(hostelBeds.roomId, hostelRooms.id))
    .leftJoin(user, eq(hostelLeavePasses.studentId, user.id))
    .where(and(...conds))
    .orderBy(desc(hostelLeavePasses.expectedReturnAt));
}

/**
 * Self-service leave passes (resident / guardian projections). Allowlisted to
 * the fields those roles may see — `reason` and `createdById` are staff-only
 * and are never returned here.
 */
export async function listLeavePassesForSelf(tenantId: string, allocationId?: string | null) {
  const conds = [eq(hostelLeavePasses.tenantId, tenantId)];
  if (allocationId) conds.push(eq(hostelLeavePasses.allocationId, allocationId));

  return db
    .select({
      id: hostelLeavePasses.id,
      studentId: hostelLeavePasses.studentId,
      status: hostelLeavePasses.status,
      startDateTime: hostelLeavePasses.startDateTime,
      expectedReturnAt: hostelLeavePasses.expectedReturnAt,
      actualReturnAt: hostelLeavePasses.actualReturnAt,
      destination: hostelLeavePasses.destination,
      guardianApprovalRequired: hostelLeavePasses.guardianApprovalRequired,
      createdAt: hostelLeavePasses.createdAt,
    })
    .from(hostelLeavePasses)
    .where(and(...conds))
    .orderBy(desc(hostelLeavePasses.expectedReturnAt));
}

export async function getLeavePass(tenantId: string, leavePassId: string) {
  const [row] = await db
    .select({
      id: hostelLeavePasses.id,
      allocationId: hostelLeavePasses.allocationId,
      studentId: hostelLeavePasses.studentId,
      studentName: user.name,
      destination: hostelLeavePasses.destination,
      reason: hostelLeavePasses.reason,
      startDateTime: hostelLeavePasses.startDateTime,
      expectedReturnAt: hostelLeavePasses.expectedReturnAt,
      actualReturnAt: hostelLeavePasses.actualReturnAt,
      guardianApprovalRequired: hostelLeavePasses.guardianApprovalRequired,
      status: hostelLeavePasses.status,
      createdById: hostelLeavePasses.createdById,
      createdAt: hostelLeavePasses.createdAt,
      updatedAt: hostelLeavePasses.updatedAt,
    })
    .from(hostelLeavePasses)
    .leftJoin(user, eq(hostelLeavePasses.studentId, user.id))
    .where(and(eq(hostelLeavePasses.id, leavePassId), eq(hostelLeavePasses.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Permission de sortie introuvable.');

  const approvals = await db
    .select({
      id: hostelLeavePassApprovals.id,
      approverId: hostelLeavePassApprovals.approverId,
      approverRole: hostelLeavePassApprovals.approverRole,
      decision: hostelLeavePassApprovals.decision,
      reason: hostelLeavePassApprovals.reason,
      createdAt: hostelLeavePassApprovals.createdAt,
    })
    .from(hostelLeavePassApprovals)
    .where(and(
      eq(hostelLeavePassApprovals.leavePassId, leavePassId),
      eq(hostelLeavePassApprovals.tenantId, tenantId),
    ))
    .orderBy(asc(hostelLeavePassApprovals.createdAt));

  const [ret] = await db.select().from(hostelLeavePassReturns)
    .where(and(eq(hostelLeavePassReturns.leavePassId, leavePassId), eq(hostelLeavePassReturns.tenantId, tenantId))).limit(1);

  return { ...row, approvals, returned: ret ?? null };
}
