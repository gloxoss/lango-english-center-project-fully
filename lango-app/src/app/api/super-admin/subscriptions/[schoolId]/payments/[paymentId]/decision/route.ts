import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { decidePayment } from '@/features/subscriptions/services/subscription-service';

type Params = { params: Promise<{ schoolId: string; paymentId: string }> };

const schema = z.object({
  approved: z.boolean(),
  amount: z.coerce.number().min(0).max(1_000_000_000).optional(),
}).strict().refine(
  // Approving records a paid renewal: an empty amount used to be stored as 0 MAD.
  // A free extension has its own license action (extend), not this endpoint.
  body => !body.approved || (body.amount !== undefined && body.amount > 0),
  { message: 'Approving a renewal needs the amount received (greater than 0).', path: ['amount'] },
);

// POST /api/super-admin/subscriptions/:schoolId/payments/:paymentId/decision
// Approves or rejects a pending renewal request. Approving records the payment
// as paid and extends the school license; rejecting closes the request.
export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const { schoolId, paymentId } = await params;
    const body = await parseJson(request, schema);

    const data = await decidePayment(ctx, schoolId, paymentId, {
      approved: body.approved,
      amount: body.amount,
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
