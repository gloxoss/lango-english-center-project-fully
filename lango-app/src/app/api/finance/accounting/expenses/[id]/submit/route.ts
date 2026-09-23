import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { submitAccountingDocument } from '@/features/accounting/services/document-service';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireCapability } from '@/libs/api/permissions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.expense.prepare');
    const { id } = await params; const data = await submitAccountingDocument(ctx.tenantId!, id, ctx.userId);
    recordAudit(ctx, 'update', 'accounting_expense', id, { action: 'submit', status: data?.status ?? null });
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}
