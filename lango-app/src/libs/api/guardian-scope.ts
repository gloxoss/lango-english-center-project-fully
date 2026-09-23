import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { guardians, guardianStudents } from '@/models/Schema';

/**
 * A parent's own children, resolved server-side from the guardianStudents
 * relationship — never trust a client-supplied studentId for this role.
 */
export async function getGuardianChildIds(tenantId: string, guardianUserId: string): Promise<string[]> {
  const [guardian] = await db
    .select({ id: guardians.id })
    .from(guardians)
    .where(and(eq(guardians.tenantId, tenantId), eq(guardians.userId, guardianUserId)))
    .limit(1);
  if (!guardian) {
    return [];
  }
  const links = await db
    .select({ studentId: guardianStudents.studentId })
    .from(guardianStudents)
    .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.guardianId, guardian.id)));
  return links.map(link => link.studentId);
}

export async function isGuardianOfStudent(tenantId: string, guardianUserId: string, studentId: string): Promise<boolean> {
  const childIds = await getGuardianChildIds(tenantId, guardianUserId);
  return childIds.includes(studentId);
}
