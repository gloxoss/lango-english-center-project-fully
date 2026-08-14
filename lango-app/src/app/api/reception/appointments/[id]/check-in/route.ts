import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { receptionAppointmentTransitionSchema } from '@/features/reception/models/reception-validation';
import { transitionAppointment } from '@/features/reception/services/appointments-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.appointment.manage');
    const { id } = await params;
    const body = await parseJson(request, receptionAppointmentTransitionSchema);
    const result = await transitionAppointment(context, id, 'checked_in', body.reason);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
