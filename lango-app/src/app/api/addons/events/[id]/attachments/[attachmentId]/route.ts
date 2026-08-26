import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { deleteEventAttachment } from '@/features/events/services/event-operations-service';

type Params = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.manage_all');

    const { id, attachmentId } = await params;
    await deleteEventAttachment(tenantId, id, attachmentId);
    recordAudit(context, 'delete', 'event_attachment', attachmentId, { eventId: id });

    return NextResponse.json({ success: true, message: 'Pièce jointe supprimée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
