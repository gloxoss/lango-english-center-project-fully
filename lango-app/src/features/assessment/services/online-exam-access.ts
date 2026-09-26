import { and, eq } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classes, classSubjects } from '@/models/Schema';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { onlineExams, subjectTeachers } from '@/models/Schema';

/**
 * The authoring view (questions + isCorrect) is for the exam's author or a
 * teacher assigned to its class subject. Admins see every exam; another
 * teacher in the school does not get the answer key. Returns the exam id.
 */
export async function assertOnlineExamAuthoringAccess(ctx: RequestContext, tenantId: string, examId: string): Promise<string> {
  const [exam] = await db
    .select({ id: onlineExams.id, createdById: onlineExams.createdById, classSubjectId: onlineExams.classSubjectId })
    .from(onlineExams)
    .where(and(eq(onlineExams.id, examId), eq(onlineExams.tenantId, tenantId)))
    .limit(1);
  if (!exam) {
    throw new ApiError(404, 'EXAM_NOT_FOUND', 'Examen introuvable.');
  }
  // Campus lock: an exam lives on the campus of the class behind its subject.
  const [campus] = await db
    .select({ branchId: classes.branchId })
    .from(classSubjects)
    .innerJoin(classes, eq(classSubjects.classId, classes.id))
    .where(eq(classSubjects.id, exam.classSubjectId))
    .limit(1);
  assertBranchScope(ctx, campus?.branchId ?? null);
  if (ctx.role !== 'teacher' || exam.createdById === ctx.userId) {
    return exam.id;
  }
  const [assigned] = await db
    .select({ id: subjectTeachers.id })
    .from(subjectTeachers)
    .where(and(
      eq(subjectTeachers.tenantId, tenantId),
      eq(subjectTeachers.classSubjectId, exam.classSubjectId),
      eq(subjectTeachers.teacherId, ctx.userId),
    ))
    .limit(1);
  if (!assigned) {
    // Same 404 as a missing exam: do not confirm another teacher's exam exists.
    throw new ApiError(404, 'EXAM_NOT_FOUND', 'Examen introuvable.');
  }
  return exam.id;
}
