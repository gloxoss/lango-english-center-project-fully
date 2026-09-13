import type { ExamTermFacts, ExamTermStage } from './exam-term-workflow';
import { and, count, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';
import {
  assessmentOutcomes,
  examHalls,
  examSchedules,
  examSeats,
  examTerms,
} from '@/features/assessment/models/assessment-schema';
import { db } from '@/libs/DB';

export type ExamTermWithFacts = {
  term: {
    id: string;
    name: string;
    code: string;
    status: ExamTermStage;
    startDate: string;
    endDate: string;
    isPublished: boolean;
  };
  facts: ExamTermFacts;
};

/**
 * Reads the counts the workflow rules compare against.
 *
 * Every query is tenant-scoped in its own right rather than relying on the term
 * id alone: exam_schedules and exam_seats each carry tenant_id, and a term id
 * guessed from another school must not be able to pull its counts.
 */
export async function loadExamTermFacts(
  tenantId: string,
  examTermId: string,
): Promise<ExamTermWithFacts | null> {
  const [term] = await db
    .select()
    .from(examTerms)
    .where(and(eq(examTerms.id, examTermId), eq(examTerms.tenantId, tenantId)))
    .limit(1);

  if (!term) {
    return null;
  }

  const scheduleScope = and(
    eq(examSchedules.tenantId, tenantId),
    eq(examSchedules.examTermId, examTermId),
    // A cancelled slot is not an exam anyone sits, so it must not hold the term
    // back for want of a hall.
    ne(examSchedules.status, 'cancelled'),
  );

  const [
    hallRows,
    scheduledRows,
    unassignedRows,
    seatRows,
    unfinishedRows,
    definitionRows,
  ] = await Promise.all([
    db.select({ total: count() }).from(examHalls).where(eq(examHalls.tenantId, tenantId)),
    db.select({ total: count() }).from(examSchedules).where(scheduleScope),
    db.select({ total: count() }).from(examSchedules).where(and(scheduleScope, isNull(examSchedules.examHallId))),
    db.select({ total: count() }).from(examSeats).where(and(eq(examSeats.tenantId, tenantId), eq(examSeats.examTermId, examTermId))),
    db.select({ total: count() }).from(examSchedules).where(and(scheduleScope, gt(examSchedules.endTime, sql`now()`))),
    db.select({ assessmentDefinitionId: examSchedules.assessmentDefinitionId }).from(examSchedules).where(scheduleScope),
  ]);

  const definitionIds = [...new Set(definitionRows.map(r => r.assessmentDefinitionId))];

  // "Pending" is the ledger's own word for a mark not yet entered. Counting
  // missing outcome *rows* instead would be wrong: a student with no row at all
  // is equally unmarked, which is why candidateCount is compared separately.
  const pendingRows = definitionIds.length === 0
    ? [{ total: 0 }]
    : await db.select({ total: count() }).from(assessmentOutcomes).where(and(
        eq(assessmentOutcomes.tenantId, tenantId),
        inArray(assessmentOutcomes.assessmentDefinitionId, definitionIds),
        eq(assessmentOutcomes.status, 'pending'),
      ));

  const candidateRows = await db
    .selectDistinct({ studentId: examSeats.studentId })
    .from(examSeats)
    .where(and(eq(examSeats.tenantId, tenantId), eq(examSeats.examTermId, examTermId)));

  const scheduledExamCount = scheduledRows[0]?.total ?? 0;

  return {
    term: {
      id: term.id,
      name: term.name,
      code: term.code,
      status: term.status as ExamTermStage,
      startDate: term.startDate,
      endDate: term.endDate,
      isPublished: term.isPublished,
    },
    facts: {
      examHallCount: hallRows[0]?.total ?? 0,
      scheduledExamCount,
      unassignedExamCount: unassignedRows[0]?.total ?? 0,
      allocatedSeatCount: seatRows[0]?.total ?? 0,
      candidateCount: candidateRows.length,
      pendingMarkCount: pendingRows[0]?.total ?? 0,
      // A term with nothing scheduled has trivially finished nothing; treating
      // that as "finished" would let an empty term slide into valuation.
      allExamsFinished: scheduledExamCount > 0 && (unfinishedRows[0]?.total ?? 0) === 0,
    },
  };
}
