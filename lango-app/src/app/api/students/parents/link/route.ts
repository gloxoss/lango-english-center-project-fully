import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardians, guardianStudents, user } from '@/models/Schema';

const linkGuardianStudentSchema = z.object({
  guardianId: z.string().uuid(),
  studentId: z.string().min(1),
  relationshipType: z.string().trim().max(100).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, linkGuardianStudentSchema);

    // Verify guardian belongs to tenant
    const [guardianRow] = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(and(eq(guardians.id, body.guardianId), eq(guardians.tenantId, tenantId)))
      .limit(1);

    if (!guardianRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Le tuteur indiqué n\'existe pas.');
    }

    // Verify student belongs to tenant
    const [studentRow] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);

    if (!studentRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'élève indiqué n\'existe pas.');
    }

    // Check if link already exists
    const [existingLink] = await db
      .select({ id: guardianStudents.id })
      .from(guardianStudents)
      .where(
        and(
          eq(guardianStudents.tenantId, tenantId),
          eq(guardianStudents.guardianId, body.guardianId),
          eq(guardianStudents.studentId, body.studentId),
        ),
      )
      .limit(1);

    let resultId: string;
    if (existingLink) {
      resultId = existingLink.id;
    } else {
      // First guardian linked to this student becomes their primary contact by
      // default (nothing else in the app sets this yet) - it's what SMS-on-absence
      // and reminder features resolve against.
      const [anyExistingLink] = await db
        .select({ id: guardianStudents.id })
        .from(guardianStudents)
        .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, body.studentId)))
        .limit(1);

      const [inserted] = await db
        .insert(guardianStudents)
        .values({
          tenantId,
          guardianId: body.guardianId,
          studentId: body.studentId,
          relationshipType: body.relationshipType || 'Parent',
          isPrimaryContact: !anyExistingLink,
        })
        .returning();
      resultId = inserted!.id;
    }

    recordAudit(context, 'create', 'guardian_student', resultId);

    return NextResponse.json({
      success: true,
      data: {
        id: resultId,
        guardianId: body.guardianId,
        studentId: body.studentId,
        studentName: studentRow.name,
      },
      message: 'Liaison tuteur-élève enregistrée avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const guardianId = searchParams.get('guardianId');
    const studentId = searchParams.get('studentId');

    if (!guardianId || !studentId) {
      return NextResponse.json({ success: false, message: 'guardianId et studentId requis' }, { status: 400 });
    }

    await db
      .delete(guardianStudents)
      .where(
        and(
          eq(guardianStudents.tenantId, tenantId),
          eq(guardianStudents.guardianId, guardianId),
          eq(guardianStudents.studentId, studentId),
        ),
      );

    recordAudit(context, 'delete', 'guardian_student', `${guardianId}:${studentId}`);

    return NextResponse.json({
      success: true,
      message: 'Liaison supprimée avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
