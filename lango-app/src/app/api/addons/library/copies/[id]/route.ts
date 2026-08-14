import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { deleteCopy, getCopy, updateCopy } from '@/features/library/services/library-catalog-service';

const schema = z.object({ shelfLocation: z.string().max(100).nullable().optional(), condition: z.enum(['new','good','fair','poor','damaged']).optional(), price: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(), acquiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), branchId: z.uuid().nullable().optional() }).strict();

export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.copy.manage');
    const { id } = await params;
    return NextResponse.json({ success: true, data: await getCopy(tenantId, id) });
  } catch (e) { return apiErrorResponse(e); }
}

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.copy.manage');
    const { id } = await params;
    const b = await parseJson(r, schema);
    const data = await updateCopy(tenantId, id, b);
    recordAudit(context, 'update', 'library_copy', id, { accessionNumber: data.accessionNumber, branchId: b.branchId ?? undefined });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}

export async function DELETE(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.copy.manage');
    const { id } = await params;
    const data = await deleteCopy(tenantId, id);
    recordAudit(context, 'delete', 'library_copy', id, { accessionNumber: data.accessionNumber });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
