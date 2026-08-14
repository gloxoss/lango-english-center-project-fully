import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { createContributor, listContributors } from '@/features/library/services/library-catalog-service';

const schema = z.object({ name: z.string().trim().min(1).max(255), primaryRole: z.string().max(80).nullable().optional() }).strict();

export async function GET(r: Request) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.catalog.read');
    return NextResponse.json({ success: true, data: await listContributors(tenantId, new URL(r.url).searchParams.get('q') ?? '') });
  } catch (e) { return apiErrorResponse(e); }
}

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.catalog.manage');
    const data = await createContributor(tenantId, await parseJson(r, schema));
    recordAudit(context, 'create', 'library_contributor', data.id, { name: data.name });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
