import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { rotateSecretValue } from '@/features/settings/services/secrets-service';

type RouteParams = { params: Promise<{ key: string }> };

// POST /api/settings/values/[key]/rotate — re-encrypt a stored secret in place
// with a fresh IV (no version bump). Gated by the secret-rotation capability.
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { key } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.secret.rotate');

    const result = await rotateSecretValue(context, key);

    recordAudit(context, 'update', 'setting', key, { action: 'rotate_secret' });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Secret chiffré à nouveau (nouvel IV). Les anciens blocs sont invalidés.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
