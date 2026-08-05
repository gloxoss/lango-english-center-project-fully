import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { classTeachers } from '@/models/Schema';

export interface ReassignClassTeacherInput {
  tenantId: string;
  classSectionId: string;
  offeringId?: string | null;
  teacherId: string;
  role?: 'primary' | 'assistant' | 'support';
  assignedBy?: string | null;
  notes?: string | null;
}

export async function reassignClassTeacher(input: ReassignClassTeacherInput) {
  const { tenantId, classSectionId, offeringId, teacherId, role = 'primary', assignedBy, notes } = input;
  const today = new Date().toISOString().split('T')[0]!;

  return await db.transaction(async (tx) => {
    // If role is primary, close any existing active primary assignment for this offering/section
    if (role === 'primary') {
      const offeringCondition = offeringId
        ? eq(classTeachers.offeringId, offeringId)
        : eq(classTeachers.classSectionId, classSectionId);

      const existingActivePrimary = await tx
        .select({ id: classTeachers.id })
        .from(classTeachers)
        .where(and(
          eq(classTeachers.tenantId, tenantId),
          offeringCondition,
          eq(classTeachers.role, 'primary'),
          isNull(classTeachers.endsOn),
        ));

      for (const row of existingActivePrimary) {
        await tx
          .update(classTeachers)
          .set({
            endsOn: today,
            status: 'inactive',
          })
          .where(and(eq(classTeachers.id, row.id), eq(classTeachers.tenantId, tenantId)));
      }
    }

    // Insert new assignment
    const [inserted] = await tx
      .insert(classTeachers)
      .values({
        tenantId,
        classSectionId,
        offeringId: offeringId ?? null,
        teacherId,
        role,
        startsOn: today,
        endsOn: null,
        status: 'active',
        assignedBy: assignedBy ?? null,
        notes: notes ?? null,
      })
      .returning();

    return inserted!;
  });
}
