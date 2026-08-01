import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { getExportJob } from '@/libs/services/export-service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/exports/[id] — check export status and download link.
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    const job = await getExportJob(id, tenantId);
    if (!job) {
      throw new ApiError(404, 'EXPORT_NOT_FOUND', 'Tâche d\'exportation introuvable.');
    }

    return NextResponse.json({ success: true, data: job });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
