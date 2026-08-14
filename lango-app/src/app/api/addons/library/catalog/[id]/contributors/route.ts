import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { setRecordContributors } from '@/features/library/services/library-catalog-service';

const schema = z.object({
  links: z.array(z.object({ contributorId: z.uuid(), role: z.string().trim().min(1).max(80), sortOrder: z.number().int().min(0).optional() })).max(200),
}).strict();

export async function PUT(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const { id } = await params;
    const b = await parseJson(r, schema);
    const data = await setRecordContributors(tenantId, id, b.links);
    recordAudit(context, 'update', 'library_bibliographic_record', id, { action: 'set_contributors', count: data.length });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
