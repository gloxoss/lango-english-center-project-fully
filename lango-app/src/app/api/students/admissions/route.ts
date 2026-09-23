import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { AdmissionService } from '@/features/students/services/admission-service';
import { parsePagination } from '@/libs/api/pagination';

const applicantCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(255),
  lastName: z.string().trim().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().trim().min(1).max(50),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['female', 'male', 'other']).optional(),
  nationality: z.string().max(100).optional(),
  motherTongue: z.string().max(50).optional(),
  city: z.string().max(100).optional(),
  bloodGroup: z.string().max(10).optional(),
  nationalId: z.string().max(100).optional(),
  branchId: z.string().uuid().optional(),
  sessionYearId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  guardianName: z.string().trim().max(255).optional(),
  guardianPhone: z.string().trim().max(50).optional(),
  guardianEmail: z.string().email().max(255).optional(),
  occupation: z.string().trim().max(255).optional(),
  address: z.string().trim().max(1000).optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  preferredLanguage: z.string().max(10).optional(),
  guardianRelation: z.string().max(50).optional(),
  guardianId: z.string().uuid().optional(),
  consentAccuracy: z.boolean().optional(),
  consentCndp: z.boolean().optional(),
  overrideDuplicate: z.boolean().optional(),
  overrideReason: z.string().trim().max(500).optional(),
}).strict();

const applicantPatchSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().trim().min(1).max(255).optional(),
  lastName: z.string().trim().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().trim().min(1).max(50).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['female', 'male', 'other']).optional(),
  nationality: z.string().max(100).optional(),
  motherTongue: z.string().max(50).optional(),
  city: z.string().max(100).optional(),
  bloodGroup: z.string().max(10).optional(),
  nationalId: z.string().max(100).optional(),
  branchId: z.string().uuid().optional(),
  sessionYearId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  guardianName: z.string().trim().max(255).optional(),
  guardianPhone: z.string().trim().max(50).optional(),
  guardianEmail: z.string().email().max(255).optional(),
  guardianRelation: z.string().max(50).optional(),
  occupation: z.string().trim().max(255).optional(),
  address: z.string().trim().max(1000).optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  preferredLanguage: z.string().max(10).optional(),
  guardianId: z.string().uuid().optional(),
  consentAccuracy: z.boolean().optional(),
  consentCndp: z.boolean().optional(),
  overrideDuplicate: z.boolean().optional(),
  overrideReason: z.string().trim().max(500).optional(),
}).strict();

const applicantUpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['applied', 'in_review', 'approved', 'rejected', 'enrolled']),
  classSectionId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().max(1000).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const { searchParams } = new URL(request.url);

    // Clamped (max 100): an unbounded ?pageSize= could pull every applicant into memory.
    const { page, pageSize } = parsePagination(searchParams);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const branchId = searchParams.get('branchId') || undefined;
    const sessionYearId = searchParams.get('sessionYearId') || undefined;

    const result = await AdmissionService.listAdmissions(context, {
      page,
      pageSize,
      search,
      status,
      branchId,
      sessionYearId,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      summary: result.summary,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const body = await parseJson(request, applicantCreateSchema);

    const result = await AdmissionService.createAdmission(context, body);

    return NextResponse.json({
      success: true,
      data: result.applicant,
      duplicateWarning: result.duplicateWarning,
      message: 'Demande d\'admission créée avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const body = await parseJson(request, applicantPatchSchema);

    const { id, ...fields } = body;
    const updated = await AdmissionService.updateAdmission(context, id, fields);

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Demande d\'admission mise à jour',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * PUT transitions status via authoritative service.
 * Supports legacy single-call transitions while adhering strictly to the new state machine.
 */
export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const body = await parseJson(request, applicantUpdateStatusSchema);

    if (body.status === 'in_review') {
      const updated = await AdmissionService.startReview(context, body.id);
      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Demande passée en revue',
      });
    }

    if (body.status === 'approved') {
      const updated = await AdmissionService.approveAdmission(context, body.id);
      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Demande approuvée avec succès. L\'inscription de l\'élève peut maintenant être finalisée.',
      });
    }

    if (body.status === 'rejected') {
      const updated = await AdmissionService.rejectAdmission(context, body.id, body.reason);
      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Demande rejetée',
      });
    }

    if (body.status === 'enrolled') {
      const result = await AdmissionService.enrollApplicant(context, body.id, {
        classSectionId: body.classSectionId,
      });
      return NextResponse.json({
        success: true,
        data: result,
        message: 'Élève inscrit avec succès dans l\'annuaire.',
      });
    }

    return NextResponse.json({
      success: false,
      message: `Statut non géré : ${body.status}`,
    }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
