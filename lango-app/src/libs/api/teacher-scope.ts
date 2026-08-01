import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { classTeachers, subjectTeachers } from '@/models/Schema';

export async function getTeacherClassSectionIds(tenantId: string, teacherUserId: string): Promise<string[]> {
  const [ctRows, stRows] = await Promise.all([
    db
      .select({ classSectionId: classTeachers.classSectionId })
      .from(classTeachers)
      .where(and(eq(classTeachers.tenantId, tenantId), eq(classTeachers.teacherId, teacherUserId))),
    db
      .select({ classSectionId: subjectTeachers.classSectionId })
      .from(subjectTeachers)
      .where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.teacherId, teacherUserId))),
  ]);

  const set = new Set<string>();
  for (const r of ctRows) {
    if (r.classSectionId) set.add(r.classSectionId);
  }
  for (const r of stRows) {
    if (r.classSectionId) set.add(r.classSectionId);
  }
  return Array.from(set);
}
