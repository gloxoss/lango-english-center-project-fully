import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { markRollCallEntries } from '@/features/hostel/services/roll-call-service';

const markSchema = z.object({
  entries: z.array(z.object({
    allocationId: z.string().uuid(),
    status: z.enum(['present', 'approved_leave', 'late', 'missing', 'sick', 'excused']),
    note: z.string().max(2000).nullable().optional(),
  })).min(1),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.supervision.manage');

    const { id } = await params;
    const body = await parseJson(request, markSchema);
    const entries = await markRollCallEntries(tenantId, context.userId, id, body.entries);
    recordAudit(context, 'update', 'hostel_roll_call', id, { entryCount: entries.length });
    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
