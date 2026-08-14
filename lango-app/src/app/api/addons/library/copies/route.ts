import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { createCopy } from '@/features/library/services/library-service';
import { listCopies } from '@/features/library/services/library-catalog-service';

const schema = z.object({ editionId: z.uuid(), branchId: z.uuid(), accessionNumber: z.string().trim().min(1).max(50), barcode: z.string().max(50).nullable().optional(), shelfLocation: z.string().max(100).nullable().optional(), condition: z.enum(['new','good','fair','poor','damaged']).optional(), price: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(), acquiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() }).strict();

export async function GET(r: Request) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.copy.manage');
    const url = new URL(r.url);
    const data = await listCopies(tenantId, {
      query: url.searchParams.get('q') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
      branchId: url.searchParams.get('branchId') ?? undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.copy.manage');
    const b = await parseJson(r, schema);
    const data = await createCopy(tenantId, b);
    recordAudit(context, 'create', 'library_copy', data.id, { accessionNumber: data.accessionNumber, barcode: b.barcode ?? undefined });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
