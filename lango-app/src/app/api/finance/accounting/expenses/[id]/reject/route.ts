import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rejectAccountingDocument } from '@/features/accounting/services/document-service';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.expense.approve');
    const [{ id }, body] = await Promise.all([params, parseJson(req, z.object({ reason: z.string().trim().min(3).max(1000) }).strict())]);
    const data = await rejectAccountingDocument(ctx.tenantId!, id, ctx.userId, body.reason);
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}
