import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { previewBulk } from '@/features/hostel/services/allocation-service';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ');

const rowSchema = z.object({
  studentId: z.string().trim().min(1).max(100),
  bedId: z.uuid(),
  startDate: isoDate,
  endDate: isoDate,
}).strict()
  .refine(d => d.endDate > d.startDate, { message: 'La date de fin doit être après la date de début.', path: ['endDate'] });

const bulkPreviewSchema = z.object({
  rows: z.array(rowSchema).min(1).max(100),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.manage');

    const body = await parseJson(request, bulkPreviewSchema);
    const result = await previewBulk(tenantId, body.rows);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
