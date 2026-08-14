import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requireCapability, type PermissionKey } from '@/libs/api/permissions';
import { getDefinition } from '@/libs/settings/registry';
import { createDraft, listDrafts, type DraftStatus } from '@/features/settings/services/drafts-service';

const DRAFT_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'applied', 'cancelled'] as const;

const createSchema = z.object({
  key: z.string().trim().min(1).max(128),
  proposedValue: z.unknown(),
  title: z.string().trim().min(1).max(255),
  reason: z.string().trim().max(1000).optional(),
  branchId: z.string().uuid().optional().nullable(),
}).strict();

// GET /api/settings/drafts?status= — proposal inbox + history.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.read');

    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status');
    const status = DRAFT_STATUSES.includes(statusParam as DraftStatus)
      ? statusParam as DraftStatus
      : undefined;

    const drafts = await listDrafts(context, status);
    return NextResponse.json({ success: true, data: { drafts } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/settings/drafts — propose a setting change.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    const body = await parseJson(request, createSchema);

    const def = getDefinition(body.key);
    await requireCapability(context, def.requiredPermission as PermissionKey);

    const draft = await createDraft(context, body);
    return NextResponse.json({ success: true, data: { draft } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
