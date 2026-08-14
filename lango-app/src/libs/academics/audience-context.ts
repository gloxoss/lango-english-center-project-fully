import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { classSections, classSubjects, user } from '@/models/Schema';

export type StudentAudienceContext = {
  sectionId: string | null;
  offeringIds: string[];
  classSubjectIds: string[];
};

// Extracted from HomeworkService.getHomeworkForStudent's original inline
// resolution (assessment-and-examination remediation, section-02) so both
// homework and the attachments-book addon resolve a student's audience
// context identically, from one place, instead of two joins that could drift.
export async function resolveStudentAudienceContext(studentId: string): Promise<StudentAudienceContext> {
  const [me] = await db.select({ classSectionId: user.classSectionId }).from(user).where(eq(user.id, studentId)).limit(1);

  if (!me?.classSectionId) {
    return { sectionId: null, offeringIds: [], classSubjectIds: [] };
  }

  const [section] = await db.select({ classId: classSections.classId, sectionId: classSections.sectionId }).from(classSections).where(eq(classSections.id, me.classSectionId)).limit(1);
  if (!section) {
    return { sectionId: null, offeringIds: [], classSubjectIds: [] };
  }

  const subjects = await db.select({ id: classSubjects.id, offeringId: classSubjects.offeringId }).from(classSubjects).where(eq(classSubjects.classId, section.classId));

  return {
    sectionId: section.sectionId,
    offeringIds: subjects.map(s => s.offeringId).filter((id): id is string => id !== null),
    classSubjectIds: subjects.map(s => s.id),
  };
}
