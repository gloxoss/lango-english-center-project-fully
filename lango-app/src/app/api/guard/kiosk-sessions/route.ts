import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardKioskStartSchema } from '@/features/guard/models/guard-validation';
import { startKioskSession } from '@/features/guard/services/kiosk-service';

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.portal.use');

    const body = await parseJson(request, guardKioskStartSchema);
    const session = await startKioskSession(context, body);
    recordAudit(context, 'create', 'guard_kiosk_session', session.id, {
      gateId: session.gateId,
      assignmentId: session.assignmentId,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: session.id,
        gateId: session.gateId,
        branchId: session.branchId,
        deviceId: session.deviceId,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        status: session.status,
      },
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
