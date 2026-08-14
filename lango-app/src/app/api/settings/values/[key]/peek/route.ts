import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import type { PermissionKey } from '@/libs/api/permissions';
import { getDefinition } from '@/libs/settings/registry';
import { peekSecretValue } from '@/features/settings/services/secrets-service';

type RouteParams = { params: Promise<{ key: string }> };

// POST /api/settings/values/[key]/peek — reveal a stored secret.
// Gated by the key's own write permission AND the dedicated secret-rotation
// capability; every reveal is audited so access is never silent.
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { key } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const def = getDefinition(key);
    await requireCapability(context, def.requiredPermission as PermissionKey);
    await requireCapability(context, 'settings.secret.rotate');

    const resolved = await peekSecretValue(context, key);

    recordAudit(context, 'update', 'setting', key, { action: 'peek_secret' });

    return NextResponse.json({
      success: true,
      data: {
        key: resolved.key,
        value: resolved.value,
        encrypted: resolved.encrypted,
        source: resolved.source,
        version: resolved.version,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
