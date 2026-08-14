// Tonight dashboard — derived supervision read model. No writes here: this
// service assembles, for a hostel + date, the roll-call status, who is out on
// approved leave, who is unaccounted for, and the open escalation count.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { user } from '@/models/Schema';
import {
  hostelAllocations,
  hostelBeds,
  hostelEscalations,
  hostelLeavePasses,
  hostelRollCallEntries,
  hostelRollCalls,
  hostelRooms,
  hostels,
} from '@/features/hostel/models/hostel-schema';
import { dateString, requireHostel } from '@/features/hostel/services/inventory-service';

export async function getTonight(tenantId: string, opts: { hostelId: string; callDate?: string | null }) {
  await requireHostel(tenantId, opts.hostelId);
  const callDate = opts.callDate ?? dateString();
  const dayStart = `${callDate}T00:00:00`;
  const dayEnd = `${callDate}T23:59:59.999`;

  // Tonight's roll call (at most one per hostel+date).
  const [rollCall] = await db.select().from(hostelRollCalls)
    .where(and(
      eq(hostelRollCalls.tenantId, tenantId),
      eq(hostelRollCalls.hostelId, opts.hostelId),
      eq(hostelRollCalls.callDate, callDate),
    )).limit(1);

  // Roster: checked-in residents whose stay covers the call date.
  const roster = await db
    .select({
      allocationId: hostelAllocations.id,
      studentId: hostelAllocations.studentId,
      studentName: user.name,
      bedCode: hostelBeds.code,
      roomCode: hostelRooms.code,
    })
    .from(hostelAllocations)
    .innerJoin(hostelBeds, eq(hostelAllocations.bedId, hostelBeds.id))
    .innerJoin(hostelRooms, eq(hostelBeds.roomId, hostelRooms.id))
    .leftJoin(user, eq(hostelAllocations.studentId, user.id))
    .where(and(
      eq(hostelAllocations.tenantId, tenantId),
      eq(hostelRooms.hostelId, opts.hostelId),
      eq(hostelAllocations.state, 'checked_in'),
      sql`${hostelAllocations.effectiveStartDate} <= ${callDate}`,
      sql`${hostelAllocations.effectiveEndDate} > ${callDate}`,
    ));

  // Roll-call entries for tonight (if the register is open).
  const entryRows = rollCall
    ? await db.select().from(hostelRollCallEntries)
        .where(and(
          eq(hostelRollCallEntries.tenantId, tenantId),
          eq(hostelRollCallEntries.rollCallId, rollCall.id),
        ))
    : [];
  const entriesByAllocation = new Map(entryRows.map(e => [e.allocationId, e]));

  // Approved leave passes covering tonight.
  const allocationIds = roster.map(r => r.allocationId);
  const leaveRows = allocationIds.length
    ? await db.select().from(hostelLeavePasses)
        .where(and(
          eq(hostelLeavePasses.tenantId, tenantId),
          eq(hostelLeavePasses.status, 'approved'),
          inArray(hostelLeavePasses.allocationId, allocationIds),
          sql`${hostelLeavePasses.startDateTime} <= ${dayEnd}`,
          sql`${hostelLeavePasses.expectedReturnAt} >= ${dayStart}`,
        ))
    : [];
  const leaveByAllocation = new Map<string, typeof leaveRows[number]>();
  for (const p of leaveRows) {
    leaveByAllocation.set(p.allocationId, p);
  }

  const residents = roster.map((r) => {
    const entry = entriesByAllocation.get(r.allocationId);
    const pass = leaveByAllocation.get(r.allocationId);
    const onLeaveTonight = Boolean(pass);
    const overdueReturn = Boolean(pass && pass.expectedReturnAt < new Date().toISOString());
    const rollCallStatus = entry?.status ?? null;
    // Accounted: has a non-missing roll-call entry, or is out on approved leave.
    const accounted = onLeaveTonight || (rollCallStatus !== null && rollCallStatus !== 'missing');
    return {
      ...r,
      rollCallStatus,
      onLeaveTonight,
      overdueReturn,
      accounted,
      leavePass: pass ? {
        id: pass.id,
        destination: pass.destination,
        startDateTime: pass.startDateTime,
        expectedReturnAt: pass.expectedReturnAt,
      } : null,
    };
  });

  // Open escalations for the date (idempotent, acked ones are excluded).
  const escalationRows = await db
    .select({ escalationType: hostelEscalations.escalationType })
    .from(hostelEscalations)
    .where(and(
      eq(hostelEscalations.tenantId, tenantId),
      eq(hostelEscalations.triggerDate, callDate),
      sql`${hostelEscalations.acknowledgedAt} IS NULL`,
    ));
  const openEscalations = { missing_rollcall: 0, overdue_return: 0 };
  for (const e of escalationRows) {
    if (e.escalationType === 'missing_rollcall' || e.escalationType === 'overdue_return') {
      openEscalations[e.escalationType] += 1;
    }
  }

  const summary = {
    total: residents.length,
    present: residents.filter(r => r.rollCallStatus === 'present' || r.rollCallStatus === 'late' || r.rollCallStatus === 'sick' || r.rollCallStatus === 'excused' || r.rollCallStatus === 'approved_leave').length,
    onLeave: residents.filter(r => r.onLeaveTonight).length,
    missing: residents.filter(r => r.rollCallStatus === 'missing').length,
    unaccounted: residents.filter(r => !r.accounted).length,
    overdueReturns: residents.filter(r => r.overdueReturn).length,
  };

  return {
    callDate,
    hostelId: opts.hostelId,
    rollCall: rollCall ? {
      id: rollCall.id,
      status: rollCall.status,
      openedById: rollCall.openedById,
      closedAt: rollCall.closedAt,
    } : null,
    residents,
    summary,
    openEscalations,
  };
}
