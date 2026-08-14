import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { deleteCategory, updateCategory } from '@/features/library/services/library-catalog-service';

const schema = z.object({ name: z.string().trim().min(1).max(255).optional(), parentId: z.uuid().nullable().optional(), sortOrder: z.number().int().min(0).optional() }).strict();

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const { id } = await params;
    const data = await updateCategory(tenantId, id, await parseJson(r, schema));
    recordAudit(context, 'update', 'library_category', id, { name: data.name });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}

export async function DELETE(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const { id } = await params;
    const data = await deleteCategory(tenantId, id);
    recordAudit(context, 'delete', 'library_category', id, { name: data.name });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
