import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { commitAllocation } from '@/features/hostel/services/allocation-service';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ');

const commitSchema = z.object({
  applicationId: z.uuid().nullable().optional(),
  studentId: z.string().trim().min(1).max(100),
  bedId: z.uuid(),
  effectiveStartDate: isoDate,
  effectiveEndDate: isoDate,
  notes: z.string().max(2000).nullable().optional(),
}).strict()
  .refine(d => d.effectiveEndDate > d.effectiveStartDate, { message: 'La date de fin doit être après la date de début.', path: ['effectiveEndDate'] });

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.manage');

    const body = await parseJson(request, commitSchema);
    const allocation = await commitAllocation(tenantId, context.userId, body);
    recordAudit(context, 'create', 'hostel_allocation', allocation.id, {
      studentId: allocation.studentId,
      bedId: allocation.bedId,
      effectiveStartDate: allocation.effectiveStartDate,
      effectiveEndDate: allocation.effectiveEndDate,
    });
    return NextResponse.json({ success: true, data: allocation }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
