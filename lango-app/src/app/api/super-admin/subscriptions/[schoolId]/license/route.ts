import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { issueLicense, extendLicense, revokeLicense } from '@/features/subscriptions/services/subscription-service';

type Params = { params: Promise<{ schoolId: string }> };

const schema = z.object({
  action: z.enum(['issue', 'extend', 'revoke']),
  months: z.coerce.number().int().min(1).max(60).optional(),
  expiresAt: z.iso.date().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

// POST /api/super-admin/subscriptions/:schoolId/license
// issue:   create a license (requires months or expiresAt)
// extend:  push the expiry out by months from now (or current expiry if later)
// revoke:  cancel the license (data untouched)
export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const { schoolId } = await params;
    const body = await parseJson(request, schema);

    if (body.action === 'issue' && !body.months && !body.expiresAt) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Précisez une durée (months) ou une date d\'expiration.');
    }
    if (body.action === 'extend' && !body.months) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Précisez le nombre de mois à ajouter.');
    }

    let data;
    if (body.action === 'issue') {
      data = await issueLicense(ctx, schoolId, { months: body.months, expiresAt: body.expiresAt, note: body.note });
    } else if (body.action === 'extend') {
      data = await extendLicense(ctx, schoolId, body.months!);
    } else {
      data = await revokeLicense(ctx, schoolId);
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
