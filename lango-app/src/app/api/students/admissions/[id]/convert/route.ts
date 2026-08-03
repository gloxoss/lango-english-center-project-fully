import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { applicants, user } from '@/models/Schema';

const convertSchema = z.object({
  classSectionId: z.string().uuid().optional(),
}).strict();

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'admissions.manage');

    const { id } = await params;
    const body = await parseJson(req, convertSchema);

    const [applicant] = await db
      .select()
      .from(applicants)
      .where(and(eq(applicants.id, id), eq(applicants.tenantId, tenantId)))
      .limit(1);

    if (!applicant) {
      throw new ApiError(404, 'ADMISSION_NOT_FOUND', 'Demande d\'admission introuvable.');
    }

    // Idempotency — already converted
    if (applicant.convertedUserId) {
      return NextResponse.json({
        success: true,
        data: { studentId: applicant.convertedUserId },
        message: 'Déjà converti — l\'élève existe.',
      });
    }

    // Guard: must be approved
    if (applicant.status !== 'approved') {
      throw new ApiError(409, 'NOT_APPROVED', `La demande doit être à l'étape "approuvé" pour être convertie (statut actuel: ${applicant.status}).`);
    }

    const result = await db.transaction(async (tx) => {
      const studentId = `STD-${Date.now().toString().slice(-8)}`;
      const fullName = `${applicant.firstName} ${applicant.lastName}`.trim();
      const matricule = `M-${Date.now().toString().slice(-6)}`;

      const [newStudent] = await tx
        .insert(user)
        .values({
          id: studentId,
          tenantId,
          name: fullName,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          email: applicant.email,
          phone: applicant.phone,
          dateOfBirth: applicant.dateOfBirth,
          guardianName: applicant.guardianName,
          guardianPhone: applicant.guardianPhone,
          guardianEmail: applicant.guardianEmail,
          matricule,
          role: 'student',
          userStatus: 'active',
          classSectionId: body.classSectionId ?? null,
        })
        .returning();

      if (!newStudent) {
        throw new ApiError(500, 'STUDENT_CREATE_FAILED', 'Impossible de créer l\'élève.');
      }

      await tx
        .update(applicants)
        .set({ convertedUserId: newStudent.id, status: 'approved' })
        .where(and(eq(applicants.id, id), eq(applicants.tenantId, tenantId)));

      return newStudent;
    });

    recordAudit(ctx, 'create', 'student_from_admission', result.id, { applicantId: id });

    return NextResponse.json({
      success: true,
      data: { studentId: result.id, matricule: result.matricule },
      message: `Élève inscrit avec succès (matricule: ${result.matricule}).`,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
