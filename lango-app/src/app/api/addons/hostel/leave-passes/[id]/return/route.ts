import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { recordReturn } from '@/features/hostel/services/leave-passes-service';

const returnSchema = z.object({
  note: z.string().max(2000).nullish(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.supervision.manage');

    const { id } = await params;
    const body = await parseJson(request, returnSchema);
    const pass = await recordReturn(tenantId, context.userId, id, { note: body.note ?? null });
    recordAudit(context, 'update', 'hostel_leave_pass', id, { status: 'returned' });
    return NextResponse.json({ success: true, data: pass });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
