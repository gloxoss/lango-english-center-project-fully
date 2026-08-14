import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { gateCredentialVerifySchema } from '@/features/guard/models/guard-validation';
import { requireActiveKiosk } from '@/features/guard/services/kiosk-service';
import { verifyGateCredential } from '@/features/guard/services/credential-adapter';
import { guardGates } from '@/features/guard/models/guard-schema';

/**
 * Single gate entry point for badge/QR verification. Every failure — unknown
 * token, revoked/expired/replaced badge, wrong gate, wrong direction, closed
 * session — maps to the same uniform `VERIFICATION_FAILED` so an attacker cannot
 * distinguish them. The precise reason is stored server-side in the evidence row.
 */
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guard.portal.use');

    const body = await parseJson(request, gateCredentialVerifySchema);

    // The kiosk session is the authoritative source for gateId/deviceId — the
    // request body never supplies them, so a wrong-gate scan cannot spoof its way
    // into a different gate's evidence.
    const session = await requireActiveKiosk(body.kioskSessionId, context);

    const [gate] = await db
      .select({ id: guardGates.id, direction: guardGates.direction, isActive: guardGates.isActive })
      .from(guardGates)
      .where(and(eq(guardGates.id, session.gateId), eq(guardGates.tenantId, tenantId)))
      .limit(1);

    const result = await verifyGateCredential({
      rawToken: body.rawToken,
      tenantId,
      gateId: session.gateId,
      gateDirection: (gate?.direction as 'entry' | 'exit' | 'both') ?? 'both',
      direction: body.direction,
      deviceId: session.deviceId,
      kioskSessionId: session.id,
      idempotencyKey: body.idempotencyKey,
      actorId: context.userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: 'VERIFICATION_FAILED', message: 'Badge non reconnu.' } },
        { status: 401 },
      );
    }

    if (result.resultStatus === 'already_processed') {
      return NextResponse.json({ success: true, data: { resultStatus: 'already_processed' } });
    }

    return NextResponse.json({
      success: true,
      data: {
        resultStatus: 'accepted',
        context: result.context,
        direction: result.direction,
        person: result.person,
        ...(result.visitId ? { visitId: result.visitId } : {}),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
