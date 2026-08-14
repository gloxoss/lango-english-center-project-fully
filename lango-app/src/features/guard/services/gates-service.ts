// Guard & Security Portal — admin configuration service (Phase 2).
// Gates, shifts and effective-dated assignments. Every query re-verifies
// tenantId on the entity itself AND on every referenced foreign id, so a
// cross-tenant gate/guard/device/shift can never leak or be bound.
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { user, branches, scannerDevices } from '@/models/Schema';
import {
  guardAssignments,
  guardGates,
  guardKioskSessions,
  guardShifts,
} from '@/features/guard/models/guard-schema';

// Sentinel end of the effective window when effectiveUntil is open-ended.
const OPEN_END = '9999-12-31T23:59:59.999Z';

// `.returning()` always yields exactly one row for a single-row INSERT/UPDATE,
// but under noUncheckedIndexedAccess the element type is `T | undefined`.
function firstRow<T>(rows: readonly T[]): T {
  return rows[0]!;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function pgConflictCode(error: unknown): string | undefined {
  for (const candidate of [error, (error as { cause?: unknown } | null)?.cause]) {
    if (typeof candidate === 'object' && candidate !== null && 'code' in candidate) {
      return String((candidate as { code: unknown }).code);
    }
  }
  return undefined;
}

function assignmentConflict(): never {
  throw new ApiError(409, 'ASSIGNMENT_CONFLICT', 'Conflit d\'affectation : le gardien ou le scanner est déjà affecté sur cette période.');
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

export async function listGates(tenantId: string, branchId?: string | null) {
  return db
    .select()
    .from(guardGates)
    .where(and(
      eq(guardGates.tenantId, tenantId),
      branchId ? eq(guardGates.branchId, branchId) : undefined,
    ))
    .orderBy(asc(guardGates.gateName));
}

async function loadGate(tenantId: string, gateId: string) {
  const [gate] = await db
    .select()
    .from(guardGates)
    .where(and(eq(guardGates.id, gateId), eq(guardGates.tenantId, tenantId)))
    .limit(1);
  if (!gate) throw new ApiError(404, 'NOT_FOUND', 'Portail introuvable.');
  return gate;
}

export async function createGate(tenantId: string, input: {
  gateCode: string;
  gateName: string;
  branchId?: string | null;
  direction: 'entry' | 'exit' | 'both';
}) {
  if (input.branchId) await verifyBranch(tenantId, input.branchId);
  const rows = await db
    .insert(guardGates)
    .values({
      tenantId,
      branchId: input.branchId ?? null,
      gateCode: input.gateCode,
      gateName: input.gateName,
      direction: input.direction,
    })
    .returning();
  return firstRow(rows);
}

export async function updateGate(tenantId: string, gateId: string, input: {
  gateCode?: string;
  gateName?: string;
  branchId?: string | null;
  direction?: 'entry' | 'exit' | 'both';
}) {
  await loadGate(tenantId, gateId);
  if (input.branchId) await verifyBranch(tenantId, input.branchId);
  const rows = await db
    .update(guardGates)
    .set({
      ...(input.gateCode !== undefined && { gateCode: input.gateCode }),
      ...(input.gateName !== undefined && { gateName: input.gateName }),
      ...(input.branchId !== undefined && { branchId: input.branchId }),
      ...(input.direction !== undefined && { direction: input.direction }),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(guardGates.id, gateId), eq(guardGates.tenantId, tenantId)))
    .returning();
  return firstRow(rows);
}

/**
 * Soft-archive only. Blocked (409 IN_USE) while the gate still has operational
 * assignments or an active kiosk session. Historical evidence rows keep their
 * reference — the gate row is never deleted.
 */
export async function archiveGate(tenantId: string, gateId: string): Promise<void> {
  await loadGate(tenantId, gateId);

  const [operational] = await db
    .select({ id: guardAssignments.id })
    .from(guardAssignments)
    .where(and(
      eq(guardAssignments.tenantId, tenantId),
      eq(guardAssignments.gateId, gateId),
      inArray(guardAssignments.status, ['scheduled', 'active']),
    ))
    .limit(1);
  if (operational) {
    throw new ApiError(409, 'IN_USE', 'Ce portail a encore des affectations actives ou planifiées.');
  }

  const [activeSession] = await db
    .select({ id: guardKioskSessions.id })
    .from(guardKioskSessions)
    .where(and(
      eq(guardKioskSessions.tenantId, tenantId),
      eq(guardKioskSessions.gateId, gateId),
      eq(guardKioskSessions.status, 'active'),
    ))
    .limit(1);
  if (activeSession) {
    throw new ApiError(409, 'IN_USE', 'Une session de kiosque est active sur ce portail.');
  }

  await db
    .update(guardGates)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(and(eq(guardGates.id, gateId), eq(guardGates.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export async function listShifts(tenantId: string, branchId?: string | null) {
  return db
    .select()
    .from(guardShifts)
    .where(and(
      eq(guardShifts.tenantId, tenantId),
      branchId ? eq(guardShifts.branchId, branchId) : undefined,
    ))
    .orderBy(asc(guardShifts.startTime));
}

async function loadShift(tenantId: string, shiftId: string) {
  const [shift] = await db
    .select()
    .from(guardShifts)
    .where(and(eq(guardShifts.id, shiftId), eq(guardShifts.tenantId, tenantId)))
    .limit(1);
  if (!shift) throw new ApiError(404, 'NOT_FOUND', 'Quart introuvable.');
  return shift;
}

export async function createShift(tenantId: string, input: {
  name: string;
  branchId?: string | null;
  startTime: string;
  endTime: string;
}) {
  if (input.branchId) await verifyBranch(tenantId, input.branchId);
  assertShiftOrder(input.startTime, input.endTime);
  const rows = await db
    .insert(guardShifts)
    .values({
      tenantId,
      branchId: input.branchId ?? null,
      name: input.name,
      startTime: input.startTime,
      endTime: input.endTime,
    })
    .returning();
  return firstRow(rows);
}

export async function updateShift(tenantId: string, shiftId: string, input: {
  name?: string;
  branchId?: string | null;
  startTime?: string;
  endTime?: string;
}) {
  await loadShift(tenantId, shiftId);
  if (input.branchId) await verifyBranch(tenantId, input.branchId);
  if (input.startTime && input.endTime) assertShiftOrder(input.startTime, input.endTime);
  const rows = await db
    .update(guardShifts)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.branchId !== undefined && { branchId: input.branchId }),
      ...(input.startTime !== undefined && { startTime: input.startTime }),
      ...(input.endTime !== undefined && { endTime: input.endTime }),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(guardShifts.id, shiftId), eq(guardShifts.tenantId, tenantId)))
    .returning();
  return firstRow(rows);
}

/** Soft-archive a shift. Blocked while any scheduled/active assignment uses it. */
export async function archiveShift(tenantId: string, shiftId: string): Promise<void> {
  await loadShift(tenantId, shiftId);

  const [operational] = await db
    .select({ id: guardAssignments.id })
    .from(guardAssignments)
    .where(and(
      eq(guardAssignments.tenantId, tenantId),
      eq(guardAssignments.shiftId, shiftId),
      inArray(guardAssignments.status, ['scheduled', 'active']),
    ))
    .limit(1);
  if (operational) {
    throw new ApiError(409, 'IN_USE', 'Ce quart a encore des affectations actives ou planifiées.');
  }

  await db
    .update(guardShifts)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(and(eq(guardShifts.id, shiftId), eq(guardShifts.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

/** Lazily flip elapsed scheduled/active assignments to 'expired' (fail closed). */
export async function expireElapsedAssignments(tenantId: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(guardAssignments)
    .set({ status: 'expired', updatedAt: now })
    .where(and(
      eq(guardAssignments.tenantId, tenantId),
      inArray(guardAssignments.status, ['scheduled', 'active']),
      sql`${guardAssignments.effectiveUntil} IS NOT NULL AND ${guardAssignments.effectiveUntil} <= ${now}`,
    ));
}

export async function listAssignments(tenantId: string, branchId?: string | null) {
  await expireElapsedAssignments(tenantId);
  return db
    .select({
      id: guardAssignments.id,
      branchId: guardAssignments.branchId,
      guardUserId: guardAssignments.guardUserId,
      guardName: user.name,
      gateId: guardAssignments.gateId,
      gateCode: guardGates.gateCode,
      gateName: guardGates.gateName,
      shiftId: guardAssignments.shiftId,
      shiftName: guardShifts.name,
      startTime: guardShifts.startTime,
      endTime: guardShifts.endTime,
      deviceId: guardAssignments.deviceId,
      deviceLabel: scannerDevices.deviceLabel,
      effectiveFrom: guardAssignments.effectiveFrom,
      effectiveUntil: guardAssignments.effectiveUntil,
      status: guardAssignments.status,
      createdAt: guardAssignments.createdAt,
      updatedAt: guardAssignments.updatedAt,
    })
    .from(guardAssignments)
    .leftJoin(user, eq(guardAssignments.guardUserId, user.id))
    .leftJoin(guardGates, eq(guardAssignments.gateId, guardGates.id))
    .leftJoin(guardShifts, eq(guardAssignments.shiftId, guardShifts.id))
    .leftJoin(scannerDevices, eq(guardAssignments.deviceId, scannerDevices.id))
    .where(and(
      eq(guardAssignments.tenantId, tenantId),
      branchId ? eq(guardAssignments.branchId, branchId) : undefined,
    ))
    .orderBy(desc(guardAssignments.effectiveFrom));
}

export async function createAssignment(tenantId: string, callerBranchId: string | null, input: {
  guardUserId: string;
  gateId: string;
  shiftId: string;
  deviceId?: string | null;
  effectiveFrom: string;
  effectiveUntil?: string | null;
}) {
  const from = new Date(input.effectiveFrom).toISOString();
  const until = input.effectiveUntil ? new Date(input.effectiveUntil).toISOString() : null;
  if (until && until <= from) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'La fin d\'effet doit être postérieure au début.');
  }

  await verifyGuardUser(tenantId, input.guardUserId);
  const gate = await verifyGate(tenantId, input.gateId);
  await verifyShift(tenantId, input.shiftId);
  if (input.deviceId) await verifyDevice(tenantId, input.deviceId);

  const branchId = gate.branchId ?? callerBranchId;
  if (!branchId) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Une branche est requise pour cette affectation (portail sans branche et aucun contexte).');
  }

  try {
    return await db.transaction(async (tx) => {
      await assertNoOverlap(tx, tenantId, { guardUserId: input.guardUserId, from, until, deviceId: input.deviceId });
      const rows = await tx
        .insert(guardAssignments)
        .values({
          tenantId,
          branchId,
          guardUserId: input.guardUserId,
          gateId: input.gateId,
          shiftId: input.shiftId,
          deviceId: input.deviceId ?? null,
          effectiveFrom: from,
          effectiveUntil: until,
          status: 'scheduled',
        })
        .returning();
      return firstRow(rows);
    });
  } catch (error) {
    if (pgConflictCode(error) === '23505') assignmentConflict();
    throw error;
  }
}

export async function updateAssignment(tenantId: string, callerBranchId: string | null, assignmentId: string, input: {
  guardUserId?: string;
  gateId?: string;
  shiftId?: string;
  deviceId?: string | null;
  effectiveFrom?: string;
  effectiveUntil?: string | null;
  status?: 'scheduled' | 'active' | 'expired' | 'cancelled';
}) {
  await loadAssignment(tenantId, assignmentId);

  const from = input.effectiveFrom !== undefined ? new Date(input.effectiveFrom).toISOString() : undefined;
  const until = input.effectiveUntil !== undefined
    ? (input.effectiveUntil ? new Date(input.effectiveUntil).toISOString() : null)
    : undefined;
  if (from !== undefined && until && until <= from) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'La fin d\'effet doit être postérieure au début.');
  }

  let gateBranchId: string | null | undefined;
  if (input.gateId) gateBranchId = (await verifyGate(tenantId, input.gateId)).branchId;
  if (input.guardUserId) await verifyGuardUser(tenantId, input.guardUserId);
  if (input.shiftId) await verifyShift(tenantId, input.shiftId);
  if (input.deviceId) await verifyDevice(tenantId, input.deviceId);

  try {
    return await db.transaction(async (tx) => {
      const current = await loadAssignmentForUpdate(tx, tenantId, assignmentId);
      const effectiveFrom = from ?? current.effectiveFrom;
      const effectiveUntil = until !== undefined ? until : current.effectiveUntil;
      const deviceId = input.deviceId !== undefined ? input.deviceId : current.deviceId;
      const guardUserId = input.guardUserId ?? current.guardUserId;

      await assertNoOverlap(tx, tenantId, {
        guardUserId,
        from: effectiveFrom,
        until: effectiveUntil,
        deviceId,
        excludeId: assignmentId,
      });

      const branchId = gateBranchId ?? current.branchId;
      const rows = await tx
        .update(guardAssignments)
        .set({
          ...(input.guardUserId !== undefined && { guardUserId: input.guardUserId }),
          ...(input.gateId !== undefined && { gateId: input.gateId }),
          ...(input.shiftId !== undefined && { shiftId: input.shiftId }),
          ...(input.deviceId !== undefined && { deviceId: input.deviceId }),
          ...(input.effectiveFrom !== undefined && { effectiveFrom: from }),
          ...(input.effectiveUntil !== undefined && { effectiveUntil: until }),
          ...(input.status !== undefined && { status: input.status }),
          branchId,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(guardAssignments.id, assignmentId), eq(guardAssignments.tenantId, tenantId)))
        .returning();
      return firstRow(rows);
    });
  } catch (error) {
    if (pgConflictCode(error) === '23505') assignmentConflict();
    throw error;
  }
}

/**
 * Cancel an assignment. Never hard-deleted (evidence references it). Refused
 * while an active kiosk session is bound to it.
 */
export async function cancelAssignment(tenantId: string, assignmentId: string): Promise<void> {
  await loadAssignment(tenantId, assignmentId);

  const [activeSession] = await db
    .select({ id: guardKioskSessions.id })
    .from(guardKioskSessions)
    .where(and(
      eq(guardKioskSessions.tenantId, tenantId),
      eq(guardKioskSessions.assignmentId, assignmentId),
      eq(guardKioskSessions.status, 'active'),
    ))
    .limit(1);
  if (activeSession) {
    throw new ApiError(409, 'IN_USE', 'Une session de kiosque active est liée à cette affectation.');
  }

  await db
    .update(guardAssignments)
    .set({ status: 'cancelled', updatedAt: new Date().toISOString() })
    .where(and(eq(guardAssignments.id, assignmentId), eq(guardAssignments.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// Reference validators — every one re-checks tenantId.
// ---------------------------------------------------------------------------

async function loadAssignment(tenantId: string, assignmentId: string) {
  const [row] = await db
    .select()
    .from(guardAssignments)
    .where(and(eq(guardAssignments.id, assignmentId), eq(guardAssignments.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Affectation introuvable.');
  return row;
}

async function loadAssignmentForUpdate(tx: Tx, tenantId: string, assignmentId: string) {
  const [row] = await tx
    .select()
    .from(guardAssignments)
    .where(and(eq(guardAssignments.id, assignmentId), eq(guardAssignments.tenantId, tenantId)))
    .for('update')
    .limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Affectation introuvable.');
  return row;
}

async function verifyBranch(tenantId: string, branchId: string) {
  const [row] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Branche introuvable.');
}

async function verifyGuardUser(tenantId: string, guardUserId: string) {
  const [row] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(and(eq(user.id, guardUserId), eq(user.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Utilisateur introuvable.');
  if (row.role !== 'guard') {
    throw new ApiError(422, 'VALIDATION_ERROR', 'L\'utilisateur affecté doit avoir le rôle gardien.');
  }
}

async function verifyGate(tenantId: string, gateId: string) {
  const [gate] = await db
    .select()
    .from(guardGates)
    .where(and(eq(guardGates.id, gateId), eq(guardGates.tenantId, tenantId)))
    .limit(1);
  if (!gate) throw new ApiError(404, 'NOT_FOUND', 'Portail introuvable.');
  if (!gate.isActive) throw new ApiError(422, 'VALIDATION_ERROR', 'Le portail est archivé.');
  return gate;
}

async function verifyShift(tenantId: string, shiftId: string) {
  const [shift] = await db
    .select()
    .from(guardShifts)
    .where(and(eq(guardShifts.id, shiftId), eq(guardShifts.tenantId, tenantId)))
    .limit(1);
  if (!shift) throw new ApiError(404, 'NOT_FOUND', 'Quart introuvable.');
  if (!shift.isActive) throw new ApiError(422, 'VALIDATION_ERROR', 'Le quart est archivé.');
}

async function verifyDevice(tenantId: string, deviceId: string) {
  const [device] = await db
    .select()
    .from(scannerDevices)
    .where(and(eq(scannerDevices.id, deviceId), eq(scannerDevices.tenantId, tenantId)))
    .limit(1);
  if (!device) throw new ApiError(404, 'NOT_FOUND', 'Scanner introuvable.');
  if (device.isDisabled) throw new ApiError(422, 'VALIDATION_ERROR', 'Le scanner est désactivé.');
}

function assertShiftOrder(startTime: string, endTime: string) {
  if (endTime <= startTime) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'La fin du quart doit être postérieure au début.');
  }
}

// ---------------------------------------------------------------------------
// Overlap guard — one effective window per guard and per device. Rows are
// FOR UPDATE locked inside the caller's transaction; the partial unique
// indexes on status='active' are the concurrency backstop.
// ---------------------------------------------------------------------------

async function assertNoOverlap(
  tx: Tx,
  tenantId: string,
  opts: { guardUserId: string; from: string; until: string | null; deviceId?: string | null; excludeId?: string },
): Promise<void> {
  const end = opts.until ?? OPEN_END;
  const overlap = sql`${guardAssignments.effectiveFrom} < ${end} AND COALESCE(${guardAssignments.effectiveUntil}, ${OPEN_END}) > ${opts.from}`;

  const base = [
    eq(guardAssignments.tenantId, tenantId),
    ne(guardAssignments.status, 'cancelled'),
  ];
  if (opts.excludeId) base.push(ne(guardAssignments.id, opts.excludeId));

  const [guardConflict] = await tx
    .select({ id: guardAssignments.id })
    .from(guardAssignments)
    .where(and(...base, eq(guardAssignments.guardUserId, opts.guardUserId), overlap))
    .for('update')
    .limit(1);
  if (guardConflict) assignmentConflict();

  if (opts.deviceId) {
    const [deviceConflict] = await tx
      .select({ id: guardAssignments.id })
      .from(guardAssignments)
      .where(and(...base, eq(guardAssignments.deviceId, opts.deviceId), overlap))
      .for('update')
      .limit(1);
    if (deviceConflict) assignmentConflict();
  }
}
