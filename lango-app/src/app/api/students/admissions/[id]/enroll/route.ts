import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { AdmissionService } from '@/features/students/services/admission-service';

type RouteParams = { params: Promise<{ id: string }> };

const enrollSchema = z.object({
  classSectionId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional(),
  sessionYearId: z.string().uuid().optional(),
}).strict();

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const { id } = await params;
    const body = await parseJson(req, enrollSchema).catch(() => ({}));

    const result = await AdmissionService.enrollApplicant(context, id, body);

    return NextResponse.json({
      success: true,
      data: result,
      message: result.alreadyEnrolled
        ? 'Candidat déjà inscrit dans l\'annuaire des élèves.'
        : 'Inscription finalisée avec succès. L\'élève est actif dans l\'annuaire.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
