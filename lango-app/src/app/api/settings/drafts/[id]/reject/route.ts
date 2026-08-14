import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requireCapability } from '@/libs/api/permissions';
import { rejectDraft } from '@/features/settings/services/drafts-service';

const schema = z.object({
  reason: z.string().trim().max(1000).optional(),
}).strict();

// POST /api/settings/drafts/[id]/reject — reject a submitted proposal.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.approve');
    const body = await parseJson(request, schema);

    const draft = await rejectDraft(context, id, body.reason);
    return NextResponse.json({ success: true, data: { draft } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
