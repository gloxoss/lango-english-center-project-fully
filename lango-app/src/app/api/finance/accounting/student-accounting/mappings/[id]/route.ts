import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { deleteSourceMapping } from '@/features/accounting/services/student-accounting-adapter';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.account.manage');
    const { id } = await params;
    const result = await deleteSourceMapping({ tenantId, userId: ctx.userId }, id);
    recordAudit(ctx, 'delete', 'accounting_source_mapping', id, {});
    return NextResponse.json({ success: true, data: result });
  } catch (error) { return apiErrorResponse(error); }
}
