import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { AdmissionService } from '@/features/students/services/admission-service';

type RouteParams = { params: Promise<{ id: string }> };

const rejectSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
}).strict();

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const { id } = await params;
    const body = await parseJson(req, rejectSchema).catch(() => ({ reason: undefined }));

    const updated = await AdmissionService.rejectAdmission(context, id, body.reason);

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Demande d\'admission rejetée.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
