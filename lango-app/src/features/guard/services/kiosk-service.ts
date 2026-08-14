// Kiosk session lifecycle — binds a session to tenant, branch, gate, device and
// operator, and enforces the fail-closed rules: session must be active, within
// its expiry window, bound to the caller, and backed by an assignment that is
// still active in its effective window. Any violation locks the session.
import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import type { RequestContext } from '@/libs/api/context';
import { scannerDevices } from '@/models/Schema';
import {
  guardAssignments,
  guardGates,
  guardKioskSessions,
  guardShifts,
} from '@/features/guard/models/guard-schema';
import { expireElapsedAssignments } from '@/features/guard/services/gates-service';

// Owner decision §15.2: default TTL 240 min, clamped to the shift end.
export const GUARD_KIOSK_TTL_MINUTES = 240;

function requireTenantId(context: RequestContext): string {
  if (!context.tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis.');
  return context.tenantId;
}

function failClosed(): never {
  throw new ApiError(403, 'NO_ACTIVE_ASSIGNMENT', 'Aucune affectation active.');
}

// The one active assignment for this guard at `now` (status + effective window).
async function loadActiveAssignment(tenantId: string, operatorId: string, nowIso: string) {
  await expireElapsedAssignments(tenantId);
  const [assignment] = await db
    .select()
    .from(guardAssignments)
    .where(and(
      eq(guardAssignments.tenantId, tenantId),
      eq(guardAssignments.guardUserId, operatorId),
      eq(guardAssignments.status, 'active'),
      sql`${guardAssignments.effectiveFrom} <= ${nowIso} AND (${guardAssignments.effectiveUntil} IS NULL OR ${guardAssignments.effectiveUntil} > ${nowIso})`,
    ))
    .limit(1);
  return assignment ?? null;
}

async function lockSession(kioskSessionId: string, tenantId: string, operatorId: string): Promise<void> {
  await db
    .update(guardKioskSessions)
    .set({ status: 'locked', lockedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(
      eq(guardKioskSessions.id, kioskSessionId),
      eq(guardKioskSessions.tenantId, tenantId),
      eq(guardKioskSessions.operatorId, operatorId),
      eq(guardKioskSessions.status, 'active'),
    ));
}

/**
 * Start a kiosk session. Fails closed (403 NO_ACTIVE_ASSIGNMENT) for any
 * start-time invalidity — no active assignment, wrong gate, archived gate/shift,
 * disabled device — so the response reveals nothing about why.
 */
export async function startKioskSession(context: RequestContext, input: {
  gateId: string;
  deviceId?: string | null;
}) {
  const tenantId = requireTenantId(context);
  const nowIso = new Date().toISOString();

  const assignment = await loadActiveAssignment(tenantId, context.userId, nowIso);
  if (!assignment || assignment.gateId !== input.gateId) failClosed();

  const [gate] = await db
    .select()
    .from(guardGates)
    .where(and(eq(guardGates.id, input.gateId), eq(guardGates.tenantId, tenantId)))
    .limit(1);
  if (!gate || !gate.isActive) failClosed();

  const [shift] = await db
    .select()
    .from(guardShifts)
    .where(and(eq(guardShifts.id, assignment.shiftId), eq(guardShifts.tenantId, tenantId)))
    .limit(1);
  if (!shift || !shift.isActive) failClosed();

  if (input.deviceId) {
    const [device] = await db
      .select()
      .from(scannerDevices)
      .where(and(eq(scannerDevices.id, input.deviceId), eq(scannerDevices.tenantId, tenantId)))
      .limit(1);
    if (!device || device.isDisabled) failClosed();
  }

  const startedAt = new Date();
  const ttlMs = GUARD_KIOSK_TTL_MINUTES * 60 * 1000;
  let expiresAt = new Date(startedAt.getTime() + ttlMs);
  const [endHour = 0, endMinute = 0] = shift.endTime.split(':').map(Number);
  const shiftEndToday = new Date(startedAt);
  shiftEndToday.setHours(endHour, endMinute, 0, 0);
  if (shiftEndToday > startedAt && shiftEndToday < expiresAt) expiresAt = shiftEndToday;

  const branchId = gate.branchId ?? context.branchId ?? assignment.branchId;

  return db.transaction(async (tx) => {
    const deviceClause = input.deviceId
      ? eq(guardKioskSessions.deviceId, input.deviceId)
      : sql`false`;
    await tx
      .update(guardKioskSessions)
      .set({ status: 'closed', updatedAt: new Date().toISOString() })
      .where(and(
        eq(guardKioskSessions.tenantId, tenantId),
        eq(guardKioskSessions.status, 'active'),
        or(
          deviceClause,
          and(
            eq(guardKioskSessions.operatorId, context.userId),
            eq(guardKioskSessions.gateId, input.gateId),
          ),
        ),
      ));

    const rows = await tx
      .insert(guardKioskSessions)
      .values({
        tenantId,
        branchId,
        gateId: input.gateId,
        deviceId: input.deviceId ?? null,
        operatorId: context.userId,
        assignmentId: assignment.id,
        startedAt: startedAt.toISOString(),
        lastSeenAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: 'active',
      })
      .returning();
    return rows[0]!;
  });
}

/**
 * Fail-closed gate for every operational guard API call. Returns the validated
 * session (its gateId/deviceId are authoritative — never trust the request body
 * for those), or locks the session and throws.
 */
export async function requireActiveKiosk(
  kioskSessionId: string,
  context: RequestContext,
): Promise<typeof guardKioskSessions.$inferSelect> {
  const tenantId = requireTenantId(context);

  const [session] = await db
    .select()
    .from(guardKioskSessions)
    .where(eq(guardKioskSessions.id, kioskSessionId))
    .limit(1);

  if (!session || session.tenantId !== tenantId || session.operatorId !== context.userId) {
    throw new ApiError(401, 'KIOSK_INVALID', 'Session de kiosque invalide.');
  }

  const now = new Date();
  const expired = now.getTime() >= new Date(session.expiresAt).getTime();
  if (session.status !== 'active' || expired) {
    await lockSession(kioskSessionId, tenantId, context.userId);
    if (expired) throw new ApiError(409, 'KIOSK_EXPIRED', 'Session de kiosque expirée.');
    throw new ApiError(401, 'KIOSK_LOCKED', 'Session de kiosque verrouillée.');
  }

  const [assignment] = await db
    .select()
    .from(guardAssignments)
    .where(and(
      eq(guardAssignments.id, session.assignmentId),
      eq(guardAssignments.tenantId, tenantId),
      eq(guardAssignments.status, 'active'),
    ))
    .limit(1);
  if (!assignment) {
    await lockSession(kioskSessionId, tenantId, context.userId);
    throw new ApiError(401, 'KIOSK_LOCKED', 'Affectation inactive.');
  }

  const aFrom = new Date(assignment.effectiveFrom).getTime();
  const aUntil = assignment.effectiveUntil ? new Date(assignment.effectiveUntil).getTime() : Infinity;
  if (now.getTime() < aFrom || now.getTime() >= aUntil) {
    await lockSession(kioskSessionId, tenantId, context.userId);
    throw new ApiError(409, 'KIOSK_EXPIRED', 'Fenêtre d\'affectation expirée.');
  }

  await db
    .update(guardKioskSessions)
    .set({ lastSeenAt: now.toISOString() })
    .where(eq(guardKioskSessions.id, kioskSessionId));

  return session;
}

export async function lockKioskSession(context: RequestContext, kioskSessionId: string): Promise<void> {
  const tenantId = requireTenantId(context);
  await lockSession(kioskSessionId, tenantId, context.userId);
}

export async function closeKioskSession(context: RequestContext, kioskSessionId: string): Promise<void> {
  const tenantId = requireTenantId(context);
  await db
    .update(guardKioskSessions)
    .set({ status: 'closed', updatedAt: new Date().toISOString() })
    .where(and(
      eq(guardKioskSessions.id, kioskSessionId),
      eq(guardKioskSessions.tenantId, tenantId),
      eq(guardKioskSessions.operatorId, context.userId),
    ));
}

// ---------------------------------------------------------------------------
// me/shift + me/gate
// ---------------------------------------------------------------------------

export async function getMyShift(context: RequestContext) {
  const tenantId = requireTenantId(context);
  const nowIso = new Date().toISOString();
  const assignment = await loadActiveAssignment(tenantId, context.userId, nowIso);
  if (!assignment) throw new ApiError(403, 'NO_ACTIVE_SHIFT', 'Aucun quart actif pour ce gardien.');

  const [gate] = await db
    .select({ id: guardGates.id, gateCode: guardGates.gateCode, gateName: guardGates.gateName, direction: guardGates.direction })
    .from(guardGates)
    .where(and(eq(guardGates.id, assignment.gateId), eq(guardGates.tenantId, tenantId)))
    .limit(1);
  const [shift] = await db
    .select({ id: guardShifts.id, name: guardShifts.name, startTime: guardShifts.startTime, endTime: guardShifts.endTime })
    .from(guardShifts)
    .where(and(eq(guardShifts.id, assignment.shiftId), eq(guardShifts.tenantId, tenantId)))
    .limit(1);

  const [session] = await db
    .select({ id: guardKioskSessions.id, status: guardKioskSessions.status, expiresAt: guardKioskSessions.expiresAt })
    .from(guardKioskSessions)
    .where(and(
      eq(guardKioskSessions.tenantId, tenantId),
      eq(guardKioskSessions.operatorId, context.userId),
      eq(guardKioskSessions.gateId, assignment.gateId),
      eq(guardKioskSessions.status, 'active'),
    ))
    .limit(1);

  return {
    assignment: {
      id: assignment.id,
      branchId: assignment.branchId,
      gateId: assignment.gateId,
      shiftId: assignment.shiftId,
      deviceId: assignment.deviceId,
      effectiveFrom: assignment.effectiveFrom,
      effectiveUntil: assignment.effectiveUntil,
      status: assignment.status,
    },
    gate,
    shift,
    kioskSession: session ?? null,
    now: nowIso,
  };
}

export async function getMyGate(context: RequestContext) {
  const tenantId = requireTenantId(context);
  const nowIso = new Date().toISOString();
  const assignment = await loadActiveAssignment(tenantId, context.userId, nowIso);
  if (!assignment) throw new ApiError(403, 'NO_ACTIVE_GATE', 'Aucun portail actif pour ce gardien.');

  const [gate] = await db
    .select({ id: guardGates.id, gateCode: guardGates.gateCode, gateName: guardGates.gateName, direction: guardGates.direction, isActive: guardGates.isActive })
    .from(guardGates)
    .where(and(eq(guardGates.id, assignment.gateId), eq(guardGates.tenantId, tenantId)))
    .limit(1);
  if (!gate || !gate.isActive) throw new ApiError(403, 'NO_ACTIVE_GATE', 'Portail inactif.');

  return {
    gate,
    branchId: assignment.branchId,
    deviceId: assignment.deviceId,
    now: nowIso,
  };
}
