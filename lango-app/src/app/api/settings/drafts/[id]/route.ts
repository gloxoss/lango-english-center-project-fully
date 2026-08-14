import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requireCapability } from '@/libs/api/permissions';
import { getDefinition } from '@/libs/settings/registry';
import { cancelDraft, getDraft, submitDraft, updateDraft } from '@/features/settings/services/drafts-service';
import type { PermissionKey } from '@/libs/api/permissions';

const patchSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  reason: z.string().trim().max(1000).optional(),
  proposedValue: z.unknown().optional(),
  action: z.enum(['submit', 'cancel']).optional(),
}).strict().refine(
  b => (b.action ? !('title' in b || 'reason' in b || 'proposedValue' in b) : true),
  { message: 'action (submit|cancel) ne peut pas être combinée avec une modification.', path: ['action'] },
);

// PATCH /api/settings/drafts/[id] — edit a draft, or submit/cancel it.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    const body = await parseJson(request, patchSchema);

    if (body.action) {
      const draft = await getDraft(context, id);
      const def = getDefinition(draft.key);
      await requireCapability(context, def.requiredPermission as PermissionKey);
      const result = body.action === 'submit' ? await submitDraft(context, id) : await cancelDraft(context, id);
      return NextResponse.json({ success: true, data: { draft: result } });
    }

    const draft = await getDraft(context, id);
    const def = getDefinition(draft.key);
    await requireCapability(context, def.requiredPermission as PermissionKey);

    const updated = await updateDraft(context, id, body);
    return NextResponse.json({ success: true, data: { draft: updated } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
