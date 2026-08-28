import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { capabilityForReportType } from '@/libs/services/exporters';
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

    // Gate on the capability the report type itself requires. Previously any
    // authenticated principal could enqueue any report: a student could export
    // 'audit-logs' and receive the whole tenant's audit trail, even though
    // GET /api/audit-logs is restricted to school_admin/super_admin. An
    // undeclared report type fails closed rather than defaulting to open.
    const capability = capabilityForReportType(body.reportType);
    if (!capability) {
      throw new ApiError(
        422,
        'UNKNOWN_REPORT_TYPE',
        `Type d'export inconnu: ${body.reportType}.`,
      );
    }
    await requireCapability(context, capability);

    const jobId = await createExportJob({
      tenantId,
      reportType: body.reportType,
      params: body.params,
      requestedBy: context.userId,
    });

    // The job is already finished by the time createExportJob returns; do not
    // report 'pending' and send the client into a poll that never changes.
    return NextResponse.json({
      success: true,
      data: { jobId, status: 'complete' },
      message: 'Export généré.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
