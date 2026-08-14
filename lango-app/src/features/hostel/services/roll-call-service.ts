// Roll call service — nightly register, one per hostel per day, separate from
// academic attendance. Roster = today's checked-in residents of the hostel.
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { user } from '@/models/Schema';
import {
  hostelAllocations,
  hostelBeds,
  hostelRollCallEntries,
  hostelRollCalls,
  hostelRooms,
} from '@/features/hostel/models/hostel-schema';
import { firstRow } from '@/features/hostel/server/db-utils';
import { dateString, requireHostel } from '@/features/hostel/services/inventory-service';
import { runEscalations } from '@/features/hostel/services/escalations-service';

export type RollCallEntryInput = {
  allocationId: string;
  status: 'present' | 'approved_leave' | 'late' | 'missing' | 'sick' | 'excused';
  note?: string | null;
};

// Roster: every checked-in resident of the hostel whose stay covers today.
export async function listResidentsForRollCall(tenantId: string, hostelId: string, callDate: string) {
  return db
    .select({
      allocationId: hostelAllocations.id,
      studentId: hostelAllocations.studentId,
      studentName: user.name,
      bedCode: hostelBeds.code,
      roomCode: hostelRooms.code,
      effectiveStartDate: hostelAllocations.effectiveStartDate,
      effectiveEndDate: hostelAllocations.effectiveEndDate,
    })
    .from(hostelAllocations)
    .innerJoin(hostelBeds, eq(hostelAllocations.bedId, hostelBeds.id))
    .innerJoin(hostelRooms, eq(hostelBeds.roomId, hostelRooms.id))
    .leftJoin(user, eq(hostelAllocations.studentId, user.id))
    .where(and(
      eq(hostelAllocations.tenantId, tenantId),
      eq(hostelRooms.hostelId, hostelId),
      eq(hostelAllocations.state, 'checked_in'),
      sql`${hostelAllocations.effectiveStartDate} <= ${callDate}`,
      sql`${hostelAllocations.effectiveEndDate} > ${callDate}`,
    ));
}

export async function openRollCall(tenantId: string, actorId: string, opts: { hostelId: string; callDate: string }) {
  await requireHostel(tenantId, opts.hostelId);
  const existing = await db.select({ id: hostelRollCalls.id }).from(hostelRollCalls)
    .where(and(
      eq(hostelRollCalls.tenantId, tenantId),
      eq(hostelRollCalls.hostelId, opts.hostelId),
      eq(hostelRollCalls.callDate, opts.callDate),
    )).limit(1);
  if (existing.length > 0) {
    throw new ApiError(409, 'ROLL_CALL_EXISTS', 'Un appel du soir existe déjà pour cette résidence à cette date.');
  }
  return firstRow(await db.insert(hostelRollCalls).values({
    tenantId,
    hostelId: opts.hostelId,
    callDate: opts.callDate,
    status: 'open',
    openedById: actorId,
  }).returning());
}

export async function listRollCalls(tenantId: string, opts?: { hostelId?: string | null; callDate?: string | null }) {
  const conds = [eq(hostelRollCalls.tenantId, tenantId)];
  if (opts?.hostelId) conds.push(eq(hostelRollCalls.hostelId, opts.hostelId));
  if (opts?.callDate) conds.push(eq(hostelRollCalls.callDate, opts.callDate));
  return db.select().from(hostelRollCalls).where(and(...conds)).orderBy(desc(hostelRollCalls.callDate));
}

export async function getRollCall(tenantId: string, rollCallId: string) {
  const [rc] = await db.select().from(hostelRollCalls)
    .where(and(eq(hostelRollCalls.id, rollCallId), eq(hostelRollCalls.tenantId, tenantId))).limit(1);
  if (!rc) throw new ApiError(404, 'NOT_FOUND', 'Appel du soir introuvable.');

  const entries = await db
    .select({
      id: hostelRollCallEntries.id,
      allocationId: hostelRollCallEntries.allocationId,
      status: hostelRollCallEntries.status,
      note: hostelRollCallEntries.note,
      notedAt: hostelRollCallEntries.notedAt,
      studentId: hostelAllocations.studentId,
      studentName: user.name,
      bedCode: hostelBeds.code,
      roomCode: hostelRooms.code,
    })
    .from(hostelRollCallEntries)
    .innerJoin(hostelAllocations, eq(hostelRollCallEntries.allocationId, hostelAllocations.id))
    .innerJoin(hostelBeds, eq(hostelAllocations.bedId, hostelBeds.id))
    .innerJoin(hostelRooms, eq(hostelBeds.roomId, hostelRooms.id))
    .leftJoin(user, eq(hostelAllocations.studentId, user.id))
    .where(and(
      eq(hostelRollCallEntries.tenantId, tenantId),
      eq(hostelRollCallEntries.rollCallId, rollCallId),
    ))
    .orderBy(asc(hostelRooms.code), asc(hostelBeds.code));

  return { ...rc, entries };
}

export async function markRollCallEntries(tenantId: string, actorId: string, rollCallId: string, entries: RollCallEntryInput[]) {
  const [rc] = await db.select().from(hostelRollCalls)
    .where(and(eq(hostelRollCalls.id, rollCallId), eq(hostelRollCalls.tenantId, tenantId))).limit(1);
  if (!rc) throw new ApiError(404, 'NOT_FOUND', 'Appel du soir introuvable.');
  if (rc.status !== 'open') {
    throw new ApiError(409, 'ROLL_CALL_CLOSED', 'Cet appel du soir est déjà clos.');
  }

  const allocationIds = entries.map(e => e.allocationId);
  const valid = allocationIds.length
    ? await db.select({ id: hostelAllocations.id }).from(hostelAllocations)
        .where(and(eq(hostelAllocations.tenantId, tenantId), inArray(hostelAllocations.id, allocationIds)))
    : [];
  const validIds = new Set(valid.map(v => v.id));
  for (const entry of entries) {
    if (!validIds.has(entry.allocationId)) {
      throw new ApiError(422, 'INVALID_ALLOCATION', 'Une des affectations n\'existe pas dans cet établissement.');
    }
  }

  const saved = [];
  for (const entry of entries) {
    const [row] = await db.insert(hostelRollCallEntries).values({
      tenantId,
      rollCallId,
      allocationId: entry.allocationId,
      status: entry.status,
      notedById: actorId,
      note: entry.note ?? null,
    })
      .onConflictDoUpdate({
        target: [hostelRollCallEntries.tenantId, hostelRollCallEntries.rollCallId, hostelRollCallEntries.allocationId],
        set: { status: entry.status, note: entry.note ?? null, notedById: actorId, lastUpdatedAt: new Date().toISOString() },
      })
      .returning();
    saved.push(row);
  }
  return saved;
}

export async function closeRollCall(tenantId: string, actorId: string, rollCallId: string) {
  const [rc] = await db.select().from(hostelRollCalls)
    .where(and(eq(hostelRollCalls.id, rollCallId), eq(hostelRollCalls.tenantId, tenantId))).limit(1);
  if (!rc) throw new ApiError(404, 'NOT_FOUND', 'Appel du soir introuvable.');
  if (rc.status !== 'open') {
    throw new ApiError(409, 'ROLL_CALL_CLOSED', 'Cet appel du soir est déjà clos.');
  }
  const closed = firstRow(await db.update(hostelRollCalls)
    .set({ status: 'closed', closedById: actorId, closedAt: new Date().toISOString() })
    .where(and(eq(hostelRollCalls.id, rollCallId), eq(hostelRollCalls.tenantId, tenantId)))
    .returning());

  // Escalation pass: missing entries become escalate-able (idempotent).
  await runEscalations(tenantId, actorId, { triggerDate: rc.callDate }).catch(() => undefined);
  return closed;
}
