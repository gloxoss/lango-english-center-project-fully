// Hostel eligibility service — deterministic admission rules evaluated BEFORE
// any write. The DB EXCLUDE constraints remain the concurrency backstop; this
// service produces human-readable reasons for the preview step (T2/T3 rely on
// the constraint, this relies on the rules).
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { studentPlacements, user } from '@/models/Schema';
import {
  hostelAllocations,
  hostelBeds,
  hostelRooms,
  hostels,
  hostelRoomCategories,
} from '@/features/hostel/models/hostel-schema';
import { dateString } from '@/features/hostel/services/inventory-service';
import { getPolicies } from '@/features/hostel/services/policies-service';

export type EligibilityResult = {
  eligible: boolean;
  reasons: string[]; // French, human-readable, shown in the preview step
};

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

export async function getStudentContext(tenantId: string, studentId: string) {
  const [student] = await db
    .select({ id: user.id, name: user.name, gender: user.gender, dateOfBirth: user.dateOfBirth })
    .from(user)
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)))
    .limit(1);
  if (!student) throw new ApiError(422, 'STUDENT_NOT_FOUND', 'Élève introuvable dans cet établissement.');

  const [placement] = await db
    .select({ classSectionId: studentPlacements.classSectionId })
    .from(studentPlacements)
    .where(and(
      eq(studentPlacements.tenantId, tenantId),
      eq(studentPlacements.studentId, studentId),
      eq(studentPlacements.isCurrent, true),
    ))
    .limit(1);

  return { student, classSectionId: placement?.classSectionId ?? null };
}

export async function evaluateBedEligibility(tenantId: string, opts: {
  bedId: string;
  studentId: string;
  startDate: string;
  endDate: string;
  /** Allocation to ignore during overlap checks (e.g. the source row of a transfer). */
  excludeAllocationId?: string | null;
}): Promise<EligibilityResult> {
  const reasons: string[] = [];
  const today = dateString();

  const [bed] = await db.select().from(hostelBeds)
    .where(and(eq(hostelBeds.id, opts.bedId), eq(hostelBeds.tenantId, tenantId))).limit(1);
  if (!bed) return { eligible: false, reasons: ['Lit introuvable.'] };
  if (bed.status !== 'active') {
    reasons.push('Ce lit n\'est pas disponible (statut hors service ou archivé).');
  }

  const [room] = await db.select().from(hostelRooms)
    .where(and(eq(hostelRooms.id, bed.roomId), eq(hostelRooms.tenantId, tenantId))).limit(1);
  if (!room) return { eligible: false, reasons: ['Chambre introuvable.'] };
  if (room.status !== 'active') {
    reasons.push('La chambre de ce lit n\'est pas active.');
  }

  const [hostel] = await db.select().from(hostels)
    .where(and(eq(hostels.id, room.hostelId), eq(hostels.tenantId, tenantId))).limit(1);
  const [category] = room.categoryId
    ? await db.select().from(hostelRoomCategories)
        .where(and(eq(hostelRoomCategories.id, room.categoryId), eq(hostelRoomCategories.tenantId, tenantId))).limit(1)
    : [undefined];
  if (hostel && hostel.status !== 'active') {
    reasons.push('La résidence est inactive.');
  }

  const { student, classSectionId } = await getStudentContext(tenantId, opts.studentId);
  const gender = student.gender as string | null;

  // Gender policy (residence + category).
  const genderPolicy = category?.eligibleGenderPolicy ?? hostel?.genderPolicy ?? 'mixed';
  if (genderPolicy !== 'mixed') {
    if (!gender || (genderPolicy === 'male_only' && gender !== 'male') || (genderPolicy === 'female_only' && gender !== 'female')) {
      reasons.push(genderPolicy === 'male_only'
        ? 'Résidence/chambre réservée aux garçons.'
        : 'Résidence/chambre réservée aux filles.');
    }
  }

  // Age window.
  const age = ageOn(student.dateOfBirth, today);
  if (age !== null) {
    if (hostel?.ageMin != null && age < hostel.ageMin) reasons.push(`Âge minimum requis: ${hostel.ageMin} ans.`);
    if (hostel?.ageMax != null && age > hostel.ageMax) reasons.push(`Âge maximum autorisé: ${hostel.ageMax} ans.`);
  }

  // Cohort restriction.
  if (category?.eligibleCohortIds && Array.isArray(category.eligibleCohortIds)
    && category.eligibleCohortIds.length > 0) {
    if (!classSectionId || !category.eligibleCohortIds.includes(classSectionId)) {
      reasons.push('Cet élève ne fait pas partie des classes éligibles à cette catégorie de chambre.');
    }
  }

  // Overlap checks (bed + student) — advisory; DB constraint is the backstop.
  const overlapActive = sql`${hostelAllocations.state} IN ('reserved', 'checked_in')
    AND ${hostelAllocations.effectiveStartDate} < ${opts.endDate}
    AND ${hostelAllocations.effectiveEndDate} > ${opts.startDate}`;

  const bedOverlap = await db.select({ id: hostelAllocations.id }).from(hostelAllocations)
    .where(and(
      eq(hostelAllocations.tenantId, tenantId),
      eq(hostelAllocations.bedId, opts.bedId),
      overlapActive,
      opts.excludeAllocationId ? ne(hostelAllocations.id, opts.excludeAllocationId) : undefined,
    )).limit(1);
  if (bedOverlap.length > 0) reasons.push('Ce lit est déjà occupé ou réservé sur la période demandée.');

  const studentOverlap = await db.select({ id: hostelAllocations.id }).from(hostelAllocations)
    .where(and(
      eq(hostelAllocations.tenantId, tenantId),
      eq(hostelAllocations.studentId, opts.studentId),
      overlapActive,
      opts.excludeAllocationId ? ne(hostelAllocations.id, opts.excludeAllocationId) : undefined,
    )).limit(1);
  if (studentOverlap.length > 0) reasons.push('Cet élève a déjà une affectation active qui chevauche la période demandée.');

  // Guardian consent policy for minors (from application record, evaluated at
  // commit time against the decision field — preview just flags the rule).
  const policies = await getPolicies(tenantId);
  if (policies.policies.guardianConsentRequiredForMinors && age !== null && age < policies.policies.majorityAge) {
    reasons.push('Le consentement du tuteur est requis pour un mineur.');
  }

  return { eligible: reasons.length === 0, reasons };
}
