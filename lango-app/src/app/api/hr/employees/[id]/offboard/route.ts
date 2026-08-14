import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { offboardEmployee } from '@/features/hr/services/offboarding-service';
import { getEmployee } from '@/features/hr/services/employees-service';

const offboardSchema = z.object({ reason: z.string().trim().max(500).nullable().optional() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.access.manage');

    const body = await parseJson(request, offboardSchema);
    await offboardEmployee(tenantId, ctx.userId, id, body.reason);

    const sensitive = await hasCapability(ctx.userId, tenantId, ctx.role, 'hr.sensitive.read');
    const data = await getEmployee(tenantId, id, sensitive);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
