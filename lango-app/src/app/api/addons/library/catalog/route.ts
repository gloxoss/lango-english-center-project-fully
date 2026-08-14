import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { createCatalogRecord } from '@/features/library/services/library-service';
import { listCatalogPage } from '@/features/library/services/library-catalog-service';

const schema = z.object({ title: z.string().trim().min(1).max(500), subtitle: z.string().max(500).nullable().optional(), language: z.string().max(50).nullable().optional(), publicationYear: z.number().int().min(1000).max(9999).nullable().optional(), summary: z.string().max(10000).nullable().optional() }).strict();

export async function GET(r: Request) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.catalog.read');
    const url = new URL(r.url);
    const data = await listCatalogPage(tenantId, {
      query: url.searchParams.get('q') ?? undefined,
      sortBy: (url.searchParams.get('sortBy') ?? undefined) as 'title' | 'created' | 'updated' | undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const data = await createCatalogRecord(tenantId, await parseJson(r, schema));
    recordAudit(context, 'create', 'library_bibliographic_record', data.id, { title: data.title });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
