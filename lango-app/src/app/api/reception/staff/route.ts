import { NextResponse } from 'next/server';
import { listStaff } from '@/features/reception/services/appointments-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAnyCapability } from '@/libs/api/permissions';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    // The host picker is shared: appointments choose a host, and the visitor
    // sign-in dialog uses the same list. Requiring only appointment.manage
    // left a visitor.manage-only front desk with an empty host dropdown.
    await requireAnyCapability(context, ['reception.appointment.manage', 'reception.visitor.manage']);
    const data = await listStaff(context);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
