import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { createExportJob, listExportJobs } from '@/libs/services/export-service';

// GET /api/exports — list recent export jobs for the current user.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    const jobs = await listExportJobs(tenantId, context.userId);

    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const createExportSchema = z.object({
  reportType: z.string().trim().min(1).max(128),
  params: z.record(z.string(), z.unknown()).optional(),
}).strict();

// POST /api/exports — enqueue a new export job.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, createExportSchema);

    const jobId = await createExportJob({
      tenantId,
      reportType: body.reportType,
      params: body.params,
      requestedBy: context.userId,
    });

    return NextResponse.json({
      success: true,
      data: { jobId, status: 'pending' },
      message: 'Demande d\'exportation enregistrée.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
