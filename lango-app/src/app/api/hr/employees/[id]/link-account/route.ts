import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { linkAccount } from '@/features/hr/services/offboarding-service';
import { getEmployee } from '@/features/hr/services/employees-service';

// user.id is the app's `USR-*` string (users/route.ts), not a UUID.
const linkAccountSchema = z.object({ userId: z.string().trim().min(1).max(100) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.access.manage');

    const body = await parseJson(request, linkAccountSchema);
    await linkAccount(tenantId, ctx.userId, id, body.userId);

    const sensitive = await hasCapability(ctx.userId, tenantId, ctx.role, 'hr.sensitive.read');
    const data = await getEmployee(tenantId, id, sensitive);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable dans cet établissement.');

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
