import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { removeEventAudienceRule } from '@/features/events/services/event-operations-service';

type Params = { params: Promise<{ id: string; ruleId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id, ruleId } = await params;
    await removeEventAudienceRule(tenantId, id, ruleId);
    recordAudit(context, 'delete', 'event_audience_rule', ruleId, { eventId: id });
    return NextResponse.json({ success: true, data: { id: ruleId } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
