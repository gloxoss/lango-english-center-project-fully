import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { resolveAdapterException } from '@/features/accounting/services/student-accounting-adapter';

const resolveSchema = z.object({
  action: z.enum(['resolve', 'dismiss']),
  note: z.string().trim().max(1000).optional(),
}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.voucher.post');
    const [{ id }, body] = await Promise.all([params, parseJson(req, resolveSchema)]);
    const result = await resolveAdapterException({ tenantId, userId: ctx.userId }, id, body.action, body.note);
    recordAudit(ctx, 'update', 'accounting_adapter_exception', id, { action: body.action, note: body.note });
    return NextResponse.json({ success: true, data: result });
  } catch (error) { return apiErrorResponse(error); }
}
