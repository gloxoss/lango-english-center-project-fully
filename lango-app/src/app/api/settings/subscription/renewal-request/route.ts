import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requestRenewal } from '@/features/subscriptions/services/subscription-service';

const schema = z.object({
  months: z.coerce.number().int().min(1).max(36),
  note: z.string().trim().max(500).optional(),
}).strict();

// POST /api/settings/subscription/renewal-request - a school requests a
// renewal/extension. Creates a pending license_payment the super-admin
// approves or rejects. No fake success: the request is real and visible.
export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'super_admin'], { allowSuspended: true });
    await requireCapability(ctx, 'settings.read');
    const tenantId = requireTenant(ctx);

    const body = await parseJson(request, schema);
    const payment = await requestRenewal(ctx, tenantId, { months: body.months, note: body.note });

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
