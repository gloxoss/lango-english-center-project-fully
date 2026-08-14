import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getAppointment, listAppointmentHistory } from '@/features/reception/services/appointments-service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.appointment.manage');
    const { id } = await params;
    const appointment = await getAppointment(context, id);
    const history = await listAppointmentHistory(context, id);
    return NextResponse.json({ success: true, data: { appointment, history } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
