import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { getGuardianChildIds } from '@/libs/api/guardian-scope';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

export type StudentAccessContext = {
  role: string;
  userId: string;
  branchId?: string | null;
};

/**
 * Authoritative student-level access check for attendance resources:
 *   - student  -> self only
 *   - parent   -> linked children only (guardianStudents)
 *   - teacher  -> students currently in an authorized section
 *   - branch-limited school_admin -> own campus only
 *   - whole-school school_admin -> tenant scope (already enforced by callers)
 *
 * Throws 404 for "not yours" on guardian scoping so a parent cannot probe
 * whether another family's student exists.
 */
export async function assertStudentAccess(
  context: StudentAccessContext,
  tenantId: string,
  studentId: string,
): Promise<void> {
  if (context.role === 'student') {
    if (studentId !== context.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Accès refusé.');
    }
    return;
  }

  const [studentRow] = await db
    .select({ branchId: user.branchId, classSectionId: user.classSectionId })
    .from(user)
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
    .limit(1);
  if (!studentRow) {
    throw new ApiError(404, 'NOT_FOUND', 'Élève introuvable.');
  }

  if (context.role === 'parent') {
    const childIds = await getGuardianChildIds(tenantId, context.userId);
    if (!childIds.includes(studentId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Élève introuvable.');
    }
    return;
  }

  if (context.role === 'teacher') {
    const assignedIds = await getTeacherClassSectionIds(tenantId, context.userId);
    if (!studentRow.classSectionId || !assignedIds.includes(studentRow.classSectionId)) {
      throw new ApiError(403, 'FORBIDDEN', 'Cet élève ne fait pas partie de vos classes.');
    }
  }

  if (context.role === 'school_admin' && context.branchId && studentRow.branchId !== context.branchId) {
    throw new ApiError(403, 'FORBIDDEN', 'Cet élève appartient à un autre campus.');
  }
}
