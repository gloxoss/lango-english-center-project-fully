import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSections, user } from '@/models/Schema';

const studentTransferSchema = z.object({
  studentId: z.string().min(1),
  targetClassSectionId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
  transferType: z.enum(['Changement de classe', 'Changement de campus', 'Sortie définitive']).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const studentsList = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        classSectionId: user.classSectionId,
        matricule: user.matricule,
      })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));

    return NextResponse.json({
      success: true,
      data: studentsList,
      total: studentsList.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, studentTransferSchema);

    // Verify student belongs to tenant
    const [student] = await db
      .select({ id: user.id, name: user.name, classSectionId: user.classSectionId })
      .from(user)
      .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);

    if (!student) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'élève indiqué n\'existe pas.');
    }

    // Verify target class section belongs to tenant
    const [targetSection] = await db
      .select({ id: classSections.id })
      .from(classSections)
      .where(and(eq(classSections.id, body.targetClassSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    if (!targetSection) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La section de classe cible n\'existe pas.');
    }

    // Execute transfer transaction
    const updatedStudent = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(user)
        .set({
          classSectionId: body.targetClassSectionId,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId)))
        .returning();

      return updated;
    });

    recordAudit(context, 'update', 'student', body.studentId, {
      previousClassSectionId: student.classSectionId,
      newClassSectionId: body.targetClassSectionId,
      reason: body.reason,
      transferType: body.transferType,
    });

    return NextResponse.json({
      success: true,
      data: updatedStudent,
      message: `Le transfert de ${student.name} a été exécuté avec succès.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
