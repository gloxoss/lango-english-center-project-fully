import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { reconcileAttendance } from '@/features/live-classrooms/services/attendance-service';

const reconcileSchema = z.object({
  note: z.string().trim().max(1000).optional(),
  manual: z.array(z.object({
    userId: z.string().trim().min(1).max(100),
    status: z.enum(['present', 'late', 'early', 'absent', 'unknown']),
  }).strict()).max(500).optional(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.attendance.manage');

    const { id } = await params;
    const body = await parseJson(request, reconcileSchema);
    const summaries = await reconcileAttendance(context, tenantId, id, {
      note: body.note,
      manual: body.manual,
    });
    return NextResponse.json({ success: true, data: summaries });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
