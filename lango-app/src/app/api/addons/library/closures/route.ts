import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { createClosureDay, listClosureDays } from '@/features/library/services/library-operations-service';

const schema = z.object({ closedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), branchId: z.uuid().nullable().optional(), reason: z.string().max(255).nullable().optional() }).strict();

export async function GET(r: Request) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.policy.manage');
    const url = new URL(r.url);
    const data = await listClosureDays(tenantId, {
      branchId: url.searchParams.get('branchId') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.policy.manage');
    const b = await parseJson(r, schema);
    const data = await createClosureDay(tenantId, b);
    recordAudit(context, 'create', 'library_closure_day', data.id, { closedOn: data.closedOn, branchId: b.branchId ?? null });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
