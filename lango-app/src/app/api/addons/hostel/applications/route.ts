import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { listApplications, createApplication } from '@/features/hostel/services/allocation-service';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ');

const applicationCreateSchema = z.object({
  studentId: z.string().trim().min(1).max(100),
  sessionYearId: z.uuid().nullable().optional(),
  requestedStartDate: isoDate,
  requestedEndDate: isoDate,
  preferredCategoryIds: z.array(z.uuid()).max(20).nullable().optional(),
  preferredRoomId: z.uuid().nullable().optional(),
  priorityReason: z.string().max(2000).nullable().optional(),
  guardianConsentStatus: z.enum(['not_required', 'required', 'approved', 'denied']).optional(),
}).strict()
  .refine(d => d.requestedEndDate > d.requestedStartDate, { message: 'La date de fin doit être après la date de début.', path: ['requestedEndDate'] });

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.read');

    const url = new URL(request.url);
    const applications = await listApplications(tenantId, {
      studentId: url.searchParams.get('studentId'),
      sessionYearId: url.searchParams.get('sessionYearId'),
      decision: url.searchParams.get('decision'),
    });
    return NextResponse.json({ success: true, data: applications });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.manage');

    const body = await parseJson(request, applicationCreateSchema);
    const application = await createApplication(tenantId, context.userId, body);
    recordAudit(context, 'create', 'hostel_application', application.id, { studentId: application.studentId });
    return NextResponse.json({ success: true, data: application }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
