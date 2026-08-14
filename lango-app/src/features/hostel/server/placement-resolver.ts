// Placement resolver — turns a student + date range into a ranked list of
// candidate beds, each annotated with deterministic eligibility reasons.
// Used by the allocation preview step; commit still re-validates and relies on
// the DB EXCLUDE constraints as the concurrency backstop.
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { hostelBeds, hostelRooms, hostels } from '@/features/hostel/models/hostel-schema';
import { evaluateBedEligibility } from '@/features/hostel/services/eligibility-service';
import type { EligibilityResult } from '@/features/hostel/services/eligibility-service';

export type CandidateBed = {
  bedId: string;
  bedCode: string;
  roomId: string;
  roomCode: string;
  hostelId: string;
  eligible: boolean;
  reasons: string[];
};

export async function resolveCandidateBeds(tenantId: string, opts: {
  studentId: string;
  startDate: string;
  endDate: string;
  hostelId?: string | null;
  categoryIds?: string[] | null;
  roomId?: string | null;
}): Promise<CandidateBed[]> {
  const roomConds = [];
  if (opts.hostelId) roomConds.push(eq(hostelRooms.hostelId, opts.hostelId));
  if (opts.categoryIds && opts.categoryIds.length > 0) roomConds.push(inArray(hostelRooms.categoryId, opts.categoryIds));
  if (opts.roomId) roomConds.push(eq(hostelRooms.id, opts.roomId));

  const rooms = await db.select({ id: hostelRooms.id }).from(hostelRooms)
    .where(and(eq(hostelRooms.tenantId, tenantId), ...roomConds));
  if (rooms.length === 0) return [];

  const roomIds = rooms.map(r => r.id);
  const beds = await db
    .select({
      id: hostelBeds.id,
      code: hostelBeds.code,
      roomId: hostelBeds.roomId,
      roomCode: hostelRooms.code,
      hostelId: hostelRooms.hostelId,
    })
    .from(hostelBeds)
    .innerJoin(hostelRooms, eq(hostelBeds.roomId, hostelRooms.id))
    .where(and(
      eq(hostelBeds.tenantId, tenantId),
      eq(hostelBeds.status, 'active'),
      inArray(hostelBeds.roomId, roomIds),
    ))
    .orderBy(asc(hostelRooms.code), asc(hostelBeds.code));

  const results: CandidateBed[] = [];
  for (const bed of beds) {
    const evalResult: EligibilityResult = await evaluateBedEligibility(tenantId, {
      bedId: bed.id,
      studentId: opts.studentId,
      startDate: opts.startDate,
      endDate: opts.endDate,
    });
    results.push({
      bedId: bed.id,
      bedCode: bed.code,
      roomId: bed.roomId,
      roomCode: bed.roomCode,
      hostelId: bed.hostelId,
      eligible: evalResult.eligible,
      reasons: evalResult.reasons,
    });
  }

  // Eligible first, then by code.
  return results.sort((a, b) => (a.eligible === b.eligible ? 0 : a.eligible ? -1 : 1));
}
