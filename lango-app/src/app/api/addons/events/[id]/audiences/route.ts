import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { addEventAudienceRule, listEventAudienceRules } from '@/features/events/services/event-operations-service';

const createRuleSchema = z.object({
  targetKind: z.enum(['school', 'role', 'class_offering', 'class_section', 'class_subject', 'user', 'group']),
  targetRoleValue: z.string().max(255).nullable().optional(),
  targetRefId: z.string().max(255).nullable().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id } = await params;
    const rules = await listEventAudienceRules(tenantId, id);
    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id } = await params;
    const body = await parseJson(request, createRuleSchema);
    const rule = await addEventAudienceRule(tenantId, id, {
      targetKind: body.targetKind,
      targetRoleValue: body.targetRoleValue ?? null,
      targetRefId: body.targetRefId ?? null,
    });
    recordAudit(context, 'create', 'event_audience_rule', rule!.id, { eventId: id, targetKind: body.targetKind });
    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
