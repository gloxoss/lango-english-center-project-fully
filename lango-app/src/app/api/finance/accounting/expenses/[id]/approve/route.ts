import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { approveAccountingDocument } from '@/features/accounting/services/document-service';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.expense.approve');
    const { id } = await params; const data = await approveAccountingDocument(ctx.tenantId!, id, ctx.userId);
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}
