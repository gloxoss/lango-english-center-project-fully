import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { deleteEdition, getEdition, updateEdition } from '@/features/library/services/library-catalog-service';

const schema = z.object({ publisherId: z.uuid().nullable().optional(), isbn13: z.string().regex(/^\d{13}$/).nullable().optional(), isbn10: z.string().regex(/^\d{10}$/).nullable().optional(), publicationYear: z.number().int().min(1000).max(9999).nullable().optional(), pages: z.number().int().positive().nullable().optional(), format: z.string().max(50).nullable().optional(), coverUrl: z.url().nullable().optional() }).strict();

export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.catalog.read');
    const { id } = await params;
    return NextResponse.json({ success: true, data: await getEdition(tenantId, id) });
  } catch (e) { return apiErrorResponse(e); }
}

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const { id } = await params;
    const data = await updateEdition(tenantId, id, await parseJson(r, schema));
    recordAudit(context, 'update', 'library_edition', id, { isbn13: data.isbn13 ?? undefined });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}

export async function DELETE(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const { id } = await params;
    const data = await deleteEdition(tenantId, id);
    recordAudit(context, 'delete', 'library_edition', id, { isbn13: data.isbn13 ?? undefined });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
