import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { deletePublisher, updatePublisher } from '@/features/library/services/library-catalog-service';

const schema = z.object({ name: z.string().trim().min(1).max(255).optional(), city: z.string().max(120).nullable().optional(), country: z.string().max(120).nullable().optional() }).strict();

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const { id } = await params;
    const data = await updatePublisher(tenantId, id, await parseJson(r, schema));
    recordAudit(context, 'update', 'library_publisher', id, { name: data.name });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}

export async function DELETE(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const { id } = await params;
    const data = await deletePublisher(tenantId, id);
    recordAudit(context, 'delete', 'library_publisher', id, { name: data.name });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
