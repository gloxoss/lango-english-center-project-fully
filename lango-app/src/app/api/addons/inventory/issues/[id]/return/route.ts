import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { returnIssue } from '@/features/inventory/services/issues-service';

const returnSchema = z.object({
  disposition: z.enum(['returned', 'damaged', 'lost']),
  reason: z.string().trim().max(500).nullable().optional(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.issue.manage');

    const body = await parseJson(request, returnSchema);
    const data = await returnIssue(context, tenantId, id, body.disposition, body.reason);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
