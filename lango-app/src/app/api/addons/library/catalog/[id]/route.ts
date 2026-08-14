import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { deleteCatalogRecord, getCatalogRecord, updateCatalogRecord } from '@/features/library/services/library-catalog-service';

const schema = z.object({ title: z.string().trim().min(1).max(500).optional(), subtitle: z.string().max(500).nullable().optional(), language: z.string().max(50).nullable().optional(), publicationYear: z.number().int().min(1000).max(9999).nullable().optional(), summary: z.string().max(10000).nullable().optional() }).strict();

export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.catalog.read');
    const { id } = await params;
    return NextResponse.json({ success: true, data: await getCatalogRecord(tenantId, id) });
  } catch (e) { return apiErrorResponse(e); }
}

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const { id } = await params;
    const data = await updateCatalogRecord(tenantId, id, await parseJson(r, schema));
    recordAudit(context, 'update', 'library_bibliographic_record', id, { title: data.title });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}

export async function DELETE(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const { id } = await params;
    const data = await deleteCatalogRecord(tenantId, id);
    recordAudit(context, 'delete', 'library_bibliographic_record', id, { title: data.title });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
