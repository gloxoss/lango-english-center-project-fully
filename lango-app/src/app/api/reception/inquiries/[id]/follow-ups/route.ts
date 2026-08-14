import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { receptionFollowUpCreateSchema } from '@/features/reception/models/reception-validation';
import { addFollowUp } from '@/features/crm/services/inquiries-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.inquiry.manage');
    const { id } = await params;
    const body = await parseJson(request, receptionFollowUpCreateSchema);
    const followUp = await addFollowUp(context.tenantId!, id, {
      type: body.type,
      notes: body.notes,
      scheduledFor: body.scheduledFor ?? null,
    }, context.userId);
    return NextResponse.json({ success: true, data: followUp }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
