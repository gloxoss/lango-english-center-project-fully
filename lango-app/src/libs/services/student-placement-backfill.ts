import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { classSections, sessionYears, studentPlacements, user } from '@/models/Schema';

export type BackfillOptions = {
  tenantId?: string;
  dryRun?: boolean;
};

export type BackfillResult = {
  totalEvaluated: number;
  backfilledCount: number;
  skippedAlreadyPlacedCount: number;
  skippedUnassignedCount: number;
  records: Array<{
    studentId: string;
    studentName: string;
    tenantId: string;
    sessionYearId: string;
    sessionYearName: string;
    classSectionId: string;
    status: 'enrolled' | 'dropped' | 'graduated';
    startDate: string;
    action: 'backfilled' | 'would_backfill' | 'skipped_already_placed' | 'skipped_no_section';
  }>;
};

/**
 * Idempotent, tenant-scoped migration service to backfill studentPlacements
 * for legacy students created prior to the student_placements architecture.
 *
 * Rules:
 * - Derives placement strictly when student has an existing classSectionId and an active session year.
 * - Idempotent: If a placement already exists for the student in that session year, skips it.
 * - Preserves date uncertainty: uses sessionYear.startDate and adds explicit audit note.
 */
export async function backfillLegacyStudentPlacements(options: BackfillOptions = {}): Promise<BackfillResult> {
  const { tenantId, dryRun = false } = options;

  const studentConditions = [eq(user.role, 'student')];
  if (tenantId) {
    studentConditions.push(eq(user.tenantId, tenantId));
  }

  const students = await db
    .select({
      id: user.id,
      name: user.name,
      tenantId: user.tenantId,
      branchId: user.branchId,
      classSectionId: user.classSectionId,
      userStatus: user.userStatus,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(...studentConditions));

  const result: BackfillResult = {
    totalEvaluated: students.length,
    backfilledCount: 0,
    skippedAlreadyPlacedCount: 0,
    skippedUnassignedCount: 0,
    records: [],
  };

  for (const s of students) {
    if (!s.tenantId) continue;

    // Rule 1: Student without classSectionId has no placement to backfill
    if (!s.classSectionId) {
      result.skippedUnassignedCount++;
      result.records.push({
        studentId: s.id,
        studentName: s.name,
        tenantId: s.tenantId,
        sessionYearId: '',
        sessionYearName: '',
        classSectionId: '',
        status: 'enrolled',
        startDate: '',
        action: 'skipped_no_section',
      });
      continue;
    }

    // Rule 2: Find authoritative default or active session year for tenant
    const sessions = await db
      .select({
        id: sessionYears.id,
        name: sessionYears.name,
        startDate: sessionYears.startDate,
        isDefault: sessionYears.isDefault,
      })
      .from(sessionYears)
      .where(eq(sessionYears.tenantId, s.tenantId))
      .orderBy(desc(sessionYears.isDefault), desc(sessionYears.startDate))
      .limit(1);

    const activeSession = sessions[0];
    if (!activeSession) {
      // No session year configured for this tenant, cannot place safely
      continue;
    }

    // Rule 3: Verify classSection actually belongs to this tenant
    const [sectionExists] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.id, s.classSectionId), eq(classSections.tenantId, s.tenantId)))
      .limit(1);

    if (!sectionExists) {
      continue;
    }

    // Rule 4: Idempotency check — check if placement already exists
    const [existingPlacement] = await db
      .select({ id: studentPlacements.id })
      .from(studentPlacements)
      .where(and(
        eq(studentPlacements.tenantId, s.tenantId),
        eq(studentPlacements.studentId, s.id),
        eq(studentPlacements.sessionYearId, activeSession.id),
      ))
      .limit(1);

    if (existingPlacement) {
      result.skippedAlreadyPlacedCount++;
      result.records.push({
        studentId: s.id,
        studentName: s.name,
        tenantId: s.tenantId,
        sessionYearId: activeSession.id,
        sessionYearName: activeSession.name,
        classSectionId: s.classSectionId,
        status: 'enrolled',
        startDate: activeSession.startDate,
        action: 'skipped_already_placed',
      });
      continue;
    }

    // Determine lifecycle placement status from student userStatus
    const placementStatus: 'enrolled' | 'dropped' | 'graduated' = s.userStatus === 'active'
      ? 'enrolled'
      : (s.userStatus === 'archived' ? 'graduated' : 'dropped');

    if (!dryRun) {
      await db.insert(studentPlacements).values({
        tenantId: s.tenantId,
        studentId: s.id,
        sessionYearId: activeSession.id,
        classSectionId: s.classSectionId,
        status: placementStatus,
        startDate: activeSession.startDate,
        isCurrent: true,
        notes: `MIGRATION_BACKFILL: Legacy placement derived from user.classSectionId (${s.classSectionId}) for session ${activeSession.name}. Exact historical admission date unrecorded.`,
      });
      result.backfilledCount++;
      result.records.push({
        studentId: s.id,
        studentName: s.name,
        tenantId: s.tenantId,
        sessionYearId: activeSession.id,
        sessionYearName: activeSession.name,
        classSectionId: s.classSectionId,
        status: placementStatus,
        startDate: activeSession.startDate,
        action: 'backfilled',
      });
    } else {
      result.backfilledCount++;
      result.records.push({
        studentId: s.id,
        studentName: s.name,
        tenantId: s.tenantId,
        sessionYearId: activeSession.id,
        sessionYearName: activeSession.name,
        classSectionId: s.classSectionId,
        status: placementStatus,
        startDate: activeSession.startDate,
        action: 'would_backfill',
      });
    }
  }

  return result;
}
