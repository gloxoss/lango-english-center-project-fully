import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requireParentContext } from '@/features/parent/api/guard';
import {
  PORTAL_PREFERENCE_KEYS,
  getPortalPreferences,
  setPortalPreference,
} from '@/features/portal/services/portal-preferences';

// GET/PATCH /api/guardian/me/preferences — the parent's own settings +
// consents over portal_preferences (tenant+user scoped, key allowlisted).
// PATCH accepts one key/value at a time; any key outside the allowlist (or a
// non-boolean value for consent keys) is rejected with 400.

const patchSchema = z.object({
  key: z.string().trim().min(1),
  value: z.unknown(),
}).strict();

export async function GET(request: Request) {
  try {
    const ctx = await requireParentContext(request);
    const rows = await getPortalPreferences(ctx.tenantId as string, ctx.userId);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireParentContext(request);
    const body = await parseJson(request, patchSchema);
    const allowed = PORTAL_PREFERENCE_KEYS as readonly string[];

    if (!allowed.includes(body.key)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PREFERENCE_KEY', message: 'Clé de préférence inconnue.' } },
        { status: 400 },
      );
    }
    const isConsent = body.key.endsWith('Consent');
    if (isConsent && typeof body.value !== 'boolean') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CONSENT_VALUE', message: 'La valeur de consentement doit être un booléen.' } },
        { status: 400 },
      );
    }

    await setPortalPreference(ctx.tenantId as string, ctx.userId, body.key, body.value);
    recordAudit(ctx, 'update', 'portal_preferences', `${ctx.userId}:${body.key}`, { key: body.key });
    const rows = await getPortalPreferences(ctx.tenantId as string, ctx.userId);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
