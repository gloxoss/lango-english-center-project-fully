import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { applicants, user } from '@/models/Schema';

const applicantCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(255),
  lastName: z.string().trim().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().trim().min(1).max(50),
  dateOfBirth: z.string().optional(),
  guardianName: z.string().trim().max(255).optional(),
  guardianPhone: z.string().trim().max(50).optional(),
  guardianEmail: z.string().email().max(255).optional(),
}).strict();

const applicantUpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['applied', 'approved', 'rejected', 'in_review']),
  classSectionId: z.string().uuid().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const rows = await db
      .select()
      .from(applicants)
      .where(eq(applicants.tenantId, tenantId));

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, applicantCreateSchema);

    // campaignId/targetProgramId intentionally omitted - see the comment on
    // applicants.campaignId in Schema.ts. Direct applicant entry, no campaign.
    const [inserted] = await db
      .insert(applicants)
      .values({
        tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        dateOfBirth: body.dateOfBirth,
        guardianName: body.guardianName,
        guardianPhone: body.guardianPhone,
        guardianEmail: body.guardianEmail,
        status: 'applied',
      })
      .returning();

    recordAudit(context, 'create', 'admission_request', inserted!.id);

    return NextResponse.json({
      success: true,
      data: inserted,
      message: 'Demande d\'admission créée avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, applicantUpdateStatusSchema);

    // Fetch existing applicant
    const [applicant] = await db
      .select()
      .from(applicants)
      .where(and(eq(applicants.id, body.id), eq(applicants.tenantId, tenantId)))
      .limit(1);

    if (!applicant) {
      return NextResponse.json({ success: false, message: 'Demande d\'admission introuvable' }, { status: 404 });
    }

    if (body.status === 'approved') {
      // Execute Approval State Machine Transaction
      const result = await db.transaction(async (tx) => {
        // 1. Generate new student record
        const studentId = `STD-${Date.now().toString().slice(-6)}`;
        const fullName = `${applicant.firstName} ${applicant.lastName}`.trim();
        const matricule = `M-${Math.floor(1000 + Math.random() * 9000)}`;

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
            classSectionId: body.classSectionId || null,
          })
          .returning();

        // 2. Update applicant status and link converted user
        const [updatedApplicant] = await tx
          .update(applicants)
          .set({
            status: 'approved',
            convertedUserId: newStudent!.id,
          })
          .where(and(eq(applicants.id, body.id), eq(applicants.tenantId, tenantId)))
          .returning();

        return { student: newStudent, applicant: updatedApplicant };
      });

      recordAudit(context, 'update', 'admission_request', body.id, { action: 'approve' });

      return NextResponse.json({
        success: true,
        data: result,
        message: 'Demande approuvée. L\'élève a été inscrit avec succès dans l\'annuaire.',
      });
    }

    // For rejection or in_review updates
    const [updated] = await db
      .update(applicants)
      .set({ status: body.status })
      .where(and(eq(applicants.id, body.id), eq(applicants.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'admission_request', body.id);

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Statut mis à jour : ${body.status}`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
