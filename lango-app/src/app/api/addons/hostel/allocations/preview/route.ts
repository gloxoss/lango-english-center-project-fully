import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { previewAllocation } from '@/features/hostel/services/allocation-service';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ');

const previewSchema = z.object({
  studentId: z.string().trim().min(1).max(100),
  bedId: z.uuid(),
  startDate: isoDate,
  endDate: isoDate,
}).strict()
  .refine(d => d.endDate > d.startDate, { message: 'La date de fin doit être après la date de début.', path: ['endDate'] });

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.manage');

    const body = await parseJson(request, previewSchema);
    const result = await previewAllocation(tenantId, {
      studentId: body.studentId,
      bedId: body.bedId,
      startDate: body.startDate,
      endDate: body.endDate,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
