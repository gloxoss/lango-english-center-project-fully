import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { receptionAppointmentRescheduleSchema } from '@/features/reception/models/reception-validation';
import { rescheduleAppointment } from '@/features/reception/services/appointments-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.appointment.manage');
    const { id } = await params;
    const body = await parseJson(request, receptionAppointmentRescheduleSchema);
    const result = await rescheduleAppointment(context, id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
