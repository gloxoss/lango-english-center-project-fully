import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { AdmissionService } from '@/features/students/services/admission-service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const { id } = await params;

    const data = await AdmissionService.getAdmissionDetail(context, id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
