import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { createEdition } from '@/features/library/services/library-service';

const schema = z.object({ recordId: z.uuid(), publisherId: z.uuid().nullable().optional(), isbn13: z.string().regex(/^\d{13}$/).nullable().optional(), isbn10: z.string().regex(/^\d{10}$/).nullable().optional(), publicationYear: z.number().int().min(1000).max(9999).nullable().optional(), pages: z.number().int().positive().nullable().optional(), format: z.string().max(50).nullable().optional(), coverUrl: z.url().nullable().optional() }).strict();

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const b = await parseJson(r, schema);
    const data = await createEdition(tenantId, b);
    recordAudit(context, 'create', 'library_edition', data.id, { recordId: b.recordId, isbn13: b.isbn13 ?? undefined });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
