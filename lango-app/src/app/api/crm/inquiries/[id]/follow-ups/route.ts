import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { addFollowUp, listFollowUps } from '@/features/crm/services/inquiries-service';

const createSchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note']),
  notes: z.string().trim().min(1).max(4000),
  scheduledFor: z.string().datetime().optional().nullable(),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'lead-crm');

    const { id } = await params;
    const data = await listFollowUps(tenantId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'lead-crm');

    const { id } = await params;
    const body = await parseJson(request, createSchema);
    const inserted = await addFollowUp(tenantId, id, {
      type: body.type,
      notes: body.notes,
      scheduledFor: body.scheduledFor ?? null,
    }, ctx.userId);

    recordAudit(ctx, 'create', 'inquiry_follow_up', inserted.id, { inquiryId: id, type: body.type });
    return NextResponse.json({ success: true, data: inserted }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
