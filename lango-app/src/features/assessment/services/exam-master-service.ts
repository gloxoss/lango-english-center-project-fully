import { db } from '@/libs/DB';
import {
  examTerms,
  examHalls,
  examSeats,
  examSchedules,
  examSupervisors,
  marksheetTemplates,
  resultPublications,
  assessmentDefinitions,
  assessmentOutcomes,
} from '../models/assessment-schema';
import { OutcomeService } from './outcome-service';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';

// Real, independently-testable time-overlap rule (future-implementation/
// assessment-and-examination remediation, section-05) - extracted so the
// exact logic used to reject a hall double-booking can be unit-tested
// without a live DB, with zero risk of drift between the tested rule and
// the real one (both call this same function).
export function doTimeRangesOverlap(existingStart: string, existingEnd: string, newStart: string, newEnd: string): boolean {
  return new Date(existingStart) <= new Date(newEnd) && new Date(existingEnd) >= new Date(newStart);
}

// Real, independently-testable seat-planning rule (section-05) - fills
// halls in order up to each one's real capacity, never exceeding it.
// Extracted the same way as doTimeRangesOverlap: the real method below
// calls this exact function, so there is no separate "test version" that
// could drift from the real logic.
export function planSeatAllocations(
  hallsInOrder: Array<{ id: string; code: string; capacity: number }>,
  studentIds: string[],
): { allocations: Array<{ hallId: string; hallCode: string; seatNumber: number; studentId: string; studentIndex: number }>; unallocatedCount: number } {
  const allocations: Array<{ hallId: string; hallCode: string; seatNumber: number; studentId: string; studentIndex: number }> = [];
  let studentIndex = 0;

  for (const hall of hallsInOrder) {
    for (let seatNum = 1; seatNum <= hall.capacity && studentIndex < studentIds.length; seatNum++) {
      allocations.push({ hallId: hall.id, hallCode: hall.code, seatNumber: seatNum, studentId: studentIds[studentIndex]!, studentIndex });
      studentIndex++;
    }
  }

  return { allocations, unallocatedCount: Math.max(0, studentIds.length - studentIndex) };
}

export class ExamMasterService {
  /**
   * Create an Exam Term.
   */
  static async createExamTerm(params: {
    tenantId: string;
    sessionYearId?: string;
    name: string;
    code: string;
    startDate: string;
    endDate: string;
  }) {
    const [term] = await db
      .insert(examTerms)
      .values({
        tenantId: params.tenantId,
        sessionYearId: params.sessionYearId,
        name: params.name,
        code: params.code,
        startDate: params.startDate,
        endDate: params.endDate,
        status: 'setup',
      })
      .returning();

    return term;
  }

  /**
   * Create an Exam Hall.
   */
  static async createExamHall(params: {
    tenantId: string;
    branchId?: string;
    name: string;
    code: string;
    capacity?: number;
    isAccessible?: boolean;
  }) {
    const [hall] = await db
      .insert(examHalls)
      .values({
        tenantId: params.tenantId,
        branchId: params.branchId,
        name: params.name,
        code: params.code,
        capacity: params.capacity || 30,
        isAccessible: params.isAccessible ?? true,
      })
      .returning();

    return hall;
  }

  /**
   * Deterministically generate capacity-aware candidate seat allocations across exam halls.
   */
  static async generateSeatAllocations(params: {
    tenantId: string;
    examTermId: string;
    studentIds: string[];
    examHallIds: string[];
  }) {
    const { tenantId, examTermId, studentIds, examHallIds } = params;

    const halls = await db
      .select()
      .from(examHalls)
      .where(and(eq(examHalls.tenantId, tenantId), inArray(examHalls.id, examHallIds)));

    if (halls.length === 0) {
      throw new Error('No valid exam halls provided for seat distribution.');
    }

    await db
      .delete(examSeats)
      .where(and(eq(examSeats.tenantId, tenantId), eq(examSeats.examTermId, examTermId)));

    const plan = planSeatAllocations(halls, studentIds);
    const createdSeats = [];

    for (const item of plan.allocations) {
      const candidateNumber = `CAND-${new Date().getFullYear()}-${String(item.studentIndex + 1).padStart(4, '0')}`;
      const deskLabel = `Bureau ${item.seatNumber} (${item.hallCode})`;

      const [seat] = await db
        .insert(examSeats)
        .values({
          tenantId,
          examTermId,
          examHallId: item.hallId,
          studentId: item.studentId,
          seatNumber: item.seatNumber,
          deskLabel,
          candidateNumber,
        })
        .returning();

      createdSeats.push(seat);
    }

    return {
      allocatedCount: createdSeats.length,
      unallocatedCount: plan.unallocatedCount,
      seats: createdSeats,
    };
  }

  /**
   * Create a schedule slot with conflict detection.
   */
  static async createExamSchedule(params: {
    tenantId: string;
    examTermId: string;
    assessmentDefinitionId: string;
    examHallId?: string;
    startTime: string;
    endTime: string;
    supervisorStaffIds?: string[];
  }) {
    const {
      tenantId,
      examTermId,
      assessmentDefinitionId,
      examHallId,
      startTime,
      endTime,
      supervisorStaffIds = [],
    } = params;

    if (examHallId) {
      const existingForHall = await db
        .select({ startTime: examSchedules.startTime, endTime: examSchedules.endTime })
        .from(examSchedules)
        .where(and(eq(examSchedules.tenantId, tenantId), eq(examSchedules.examHallId, examHallId)));

      const hasConflict = existingForHall.some(s => doTimeRangesOverlap(s.startTime, s.endTime, startTime, endTime));
      if (hasConflict) {
        throw new Error('Scheduling conflict: Exam hall is already booked during this time window.');
      }
    }

    const [schedule] = await db
      .insert(examSchedules)
      .values({
        tenantId,
        examTermId,
        assessmentDefinitionId,
        examHallId,
        startTime,
        endTime,
        status: 'published',
      })
      .returning();

    if (!schedule) {
      throw new Error('Failed to create exam schedule.');
    }

    if (supervisorStaffIds.length > 0) {
      const scheduleId = schedule.id;
      await db.insert(examSupervisors).values(
        supervisorStaffIds.map((staffId, idx) => ({
          examScheduleId: scheduleId,
          staffId,
          role: idx === 0 ? 'chief_invigilator' : 'invigilator',
          attendanceStatus: 'assigned',
        }))
      );
    }

    return schedule;
  }

  /**
   * Save controlled mark entry roster in bulk and sync to shared outcome ledger.
   */
  static async saveMarksheetGrid(params: {
    tenantId: string;
    assessmentDefinitionId: string;
    markerId: string;
    marks: Array<{
      studentId: string;
      rawScore?: number;
      status?: 'graded' | 'exempted' | 'absent' | 'withheld';
    }>;
  }) {
    const { tenantId, assessmentDefinitionId, markerId, marks } = params;

    const recordedOutcomes = [];
    for (const item of marks) {
      const outcome = await OutcomeService.recordOutcome({
        tenantId,
        assessmentDefinitionId,
        studentId: item.studentId,
        rawScore: item.rawScore,
        status: item.status || 'graded',
        sourceType: 'paper_exam',
        markerId,
        reason: 'Mark entry saved via Marksheet grid',
      });
      recordedOutcomes.push(outcome);
    }

    return recordedOutcomes;
  }

  /**
   * Generate session-scoped class rankings deterministically.
   */
  static async generateTermRankings(tenantId: string, assessmentDefinitionId: string) {
    const outcomes = await db
      .select({
        id: assessmentOutcomes.id,
        studentId: assessmentOutcomes.studentId,
        normalizedScore: assessmentOutcomes.normalizedScore,
        grade: assessmentOutcomes.grade,
      })
      .from(assessmentOutcomes)
      .where(
        and(
          eq(assessmentOutcomes.tenantId, tenantId),
          eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitionId)
        )
      )
      .orderBy(desc(sql`CAST(${assessmentOutcomes.normalizedScore} AS NUMERIC)`));

    let currentRank = 1;
    return outcomes.map((o, idx) => {
      if (idx > 0 && Number(o.normalizedScore) < Number(outcomes[idx - 1]?.normalizedScore)) {
        currentRank = idx + 1;
      }
      return {
        ...o,
        rank: currentRank,
      };
    });
  }
}
