// Resident / guardian self-service projections. Hard rule: these read models
// never expose roommates, other residents, or safeguarding details (restricted
// `reason` fields, escalations). A resident sees only their own stay, their
// own leave passes, and their own roll-call status.
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { guardianStudents, guardians, user } from '@/models/Schema';
import {
  hostelAllocations,
  hostelBeds,
  hostelRooms,
  hostels,
} from '@/features/hostel/models/hostel-schema';
import { dateString } from '@/features/hostel/services/inventory-service';
import { getTonight } from '@/features/hostel/services/tonight-service';
import { listLeavePassesForSelf } from '@/features/hostel/services/leave-passes-service';

export async function getCurrentStay(tenantId: string, studentId: string) {
  const today = dateString();
  const [row] = await db
    .select({
      allocationId: hostelAllocations.id,
      state: hostelAllocations.state,
      effectiveStartDate: hostelAllocations.effectiveStartDate,
      effectiveEndDate: hostelAllocations.effectiveEndDate,
      checkedInAt: hostelAllocations.checkedInAt,
      bedCode: hostelBeds.code,
      roomCode: hostelRooms.code,
      hostelId: hostelRooms.hostelId,
      hostelCode: hostels.code,
      hostelName: hostels.name,
    })
    .from(hostelAllocations)
    .innerJoin(hostelBeds, eq(hostelAllocations.bedId, hostelBeds.id))
    .innerJoin(hostelRooms, eq(hostelBeds.roomId, hostelRooms.id))
    .innerJoin(hostels, eq(hostelRooms.hostelId, hostels.id))
    .where(and(
      eq(hostelAllocations.tenantId, tenantId),
      eq(hostelAllocations.studentId, studentId),
      eq(hostelAllocations.state, 'checked_in'),
      sql`${hostelAllocations.effectiveStartDate} <= ${today}`,
      sql`${hostelAllocations.effectiveEndDate} > ${today}`,
    ))
    .limit(1);
  return row ?? null;
}

export async function getResidentProjection(tenantId: string, studentId: string) {
  const stay = await getCurrentStay(tenantId, studentId);
  if (!stay) return { enrolled: false };

  const tonight = await getTonight(tenantId, { hostelId: stay.hostelId });
  const me = tonight.residents.find(r => r.allocationId === stay.allocationId) ?? null;
  const leavePasses = await listLeavePassesForSelf(tenantId, stay.allocationId);

  return {
    enrolled: true,
    stay: {
      allocationId: stay.allocationId,
      state: stay.state,
      effectiveStartDate: stay.effectiveStartDate,
      effectiveEndDate: stay.effectiveEndDate,
      checkedInAt: stay.checkedInAt,
      bedCode: stay.bedCode,
      roomCode: stay.roomCode,
      hostel: { id: stay.hostelId, code: stay.hostelCode, name: stay.hostelName },
    },
    tonight: me
      ? {
          rollCallStatus: me.rollCallStatus,
          onLeaveTonight: me.onLeaveTonight,
          overdueReturn: me.overdueReturn,
          leavePass: me.leavePass,
        }
      : null,
    leavePasses,
  };
}

export async function getGuardianProjection(tenantId: string, guardianUserId: string) {
  const [guardian] = await db.select().from(guardians)
    .where(and(eq(guardians.tenantId, tenantId), eq(guardians.userId, guardianUserId))).limit(1);
  if (!guardian) throw new ApiError(404, 'NOT_FOUND', 'Profil tuteur introuvable.');

  const links = await db.select({ studentId: guardianStudents.studentId }).from(guardianStudents)
    .where(eq(guardianStudents.guardianId, guardian.id));

  const children = [];
  for (const link of links) {
    const [student] = await db.select({ id: user.id, name: user.name }).from(user)
      .where(and(eq(user.id, link.studentId), eq(user.tenantId, tenantId))).limit(1);
    if (!student) continue;
    const stay = await getCurrentStay(tenantId, student.id);
    const child: Record<string, unknown> = {
      studentId: student.id,
      studentName: student.name,
      enrolled: Boolean(stay),
    };
    if (stay) {
      const tonight = await getTonight(tenantId, { hostelId: stay.hostelId });
      const me = tonight.residents.find(r => r.allocationId === stay.allocationId) ?? null;
      child.stay = {
        allocationId: stay.allocationId,
        effectiveStartDate: stay.effectiveStartDate,
        effectiveEndDate: stay.effectiveEndDate,
        bedCode: stay.bedCode,
        roomCode: stay.roomCode,
        hostel: { id: stay.hostelId, code: stay.hostelCode, name: stay.hostelName },
      };
      child.tonight = me
        ? { rollCallStatus: me.rollCallStatus, onLeaveTonight: me.onLeaveTonight, overdueReturn: me.overdueReturn, leavePass: me.leavePass }
        : null;
      child.leavePasses = await listLeavePassesForSelf(tenantId, stay.allocationId);
    } else {
      child.tonight = null;
      child.leavePasses = [];
    }
    children.push(child);
  }

  return { children };
}
