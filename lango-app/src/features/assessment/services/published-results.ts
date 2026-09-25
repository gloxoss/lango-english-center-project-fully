import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { classSubjects, subjects } from '@/models/Schema';
import {
  assessmentDefinitions,
  assessmentOutcomes,
} from '@/features/assessment/models/assessment-schema';

export type PublishedResultRow = {
  assessmentId: string;
  title: string;
  type: string;
  subjectId: string | null;
  subjectName: string | null;
  maximumScore: string;
  rawScore: string | null;
  normalizedScore: string | null;
  maximumScoreSnapshot: string;
  grade: string | null;
  status: string;
  gradedAt: string;
};

/**
 * Authoritative published-results query shared across guardian and student portals.
 * Only moderationState = 'published' and final statuses ('graded', 'exempted', 'absent')
 * are returned. Never exposes markerId, revisions, or draft/internal data.
 */
export async function getPublishedResultsForStudent(
  tenantId: string,
  studentId: string,
) {
  return db
    .select({
      assessmentId: assessmentDefinitions.id,
      title: assessmentDefinitions.title,
      type: assessmentDefinitions.type,
      subjectId: classSubjects.subjectId,
      subjectName: subjects.name,
      maximumScore: assessmentDefinitions.maximumScore,
      rawScore: assessmentOutcomes.rawScore,
      normalizedScore: assessmentOutcomes.normalizedScore,
      maximumScoreSnapshot: assessmentOutcomes.maximumScoreSnapshot,
      grade: assessmentOutcomes.grade,
      status: assessmentOutcomes.status,
      gradedAt: assessmentOutcomes.updatedAt,
    })
    .from(assessmentOutcomes)
    .innerJoin(
      assessmentDefinitions,
      eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitions.id),
    )
    .leftJoin(classSubjects, eq(assessmentDefinitions.classSubjectId, classSubjects.id))
    .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(
      and(
        eq(assessmentOutcomes.tenantId, tenantId),
        eq(assessmentOutcomes.studentId, studentId),
        eq(assessmentOutcomes.moderationState, 'published'),
        inArray(assessmentOutcomes.status, ['graded', 'exempted', 'absent']),
      ),
    )
    .orderBy(assessmentOutcomes.updatedAt);
}
