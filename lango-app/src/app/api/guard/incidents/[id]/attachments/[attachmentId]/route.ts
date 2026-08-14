import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { archiveIncidentAttachment } from '@/features/guard/services/incidents-service';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.incidents.manage');
    const { attachmentId } = await params;
    await archiveIncidentAttachment(context, attachmentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
