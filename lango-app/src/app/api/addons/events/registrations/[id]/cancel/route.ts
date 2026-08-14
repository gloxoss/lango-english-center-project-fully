import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { cancelRegistration } from '@/features/events/services/event-operations-service';

type Params = { params: Promise<{ id: string }> };

// Cancelling frees a seat; the next queued waitlist entry is promoted to an
// expiring offer in the same transaction. Staff with events.registration.manage
// may cancel any registration; everyone else may only cancel their own (the
// same self-service-vs-manage split as occurrences/[id]/waitlist/.../respond).
export async function POST(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    const canManageOthers = await hasCapability(context.userId, tenantId, context.role, 'events.registration.manage');
    const { id } = await params;
    const result = await cancelRegistration(tenantId, id, context.userId, canManageOthers ? undefined : context.userId);
    recordAudit(context, 'update', 'event_registration', id, { status: 'cancelled' });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
