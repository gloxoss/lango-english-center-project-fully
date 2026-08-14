import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { deleteClosureDay } from '@/features/library/services/library-operations-service';

export async function DELETE(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.policy.manage');
    const { id } = await params;
    const data = await deleteClosureDay(tenantId, id);
    recordAudit(context, 'delete', 'library_closure_day', id, { closedOn: data.closedOn });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
