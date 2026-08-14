import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { postApprovedAccountingDocument } from '@/features/accounting/services/document-service';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';

const schema = z.object({ idempotencyKey: z.string().trim().min(8).max(160), journalCode: z.string().trim().min(1).max(20), voucherTypeCode: z.string().trim().min(1).max(30) }).strict();
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.voucher.post');
    const [{ id }, body] = await Promise.all([params, parseJson(req, schema)]);
    const data = await postApprovedAccountingDocument({ tenantId: ctx.tenantId!, documentId: id, actorId: ctx.userId, ...body });
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}
