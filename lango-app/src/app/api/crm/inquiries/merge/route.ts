import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { mergeInquiries } from '@/features/crm/services/inquiries-service';

const mergeSchema = z.object({
  primaryId: z.string().uuid(),
  secondaryIds: z.array(z.string().uuid()).min(1).max(20),
}).strict();

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'lead-crm');

    const body = await parseJson(request, mergeSchema);
    const merged = await mergeInquiries(ctx, body.primaryId, body.secondaryIds);
    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
