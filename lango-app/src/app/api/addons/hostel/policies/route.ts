import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { getPolicies, upsertPolicies } from '@/features/hostel/services/policies-service';

const policyUpdateSchema = z.object({
  policies: z.record(z.string(), z.unknown()),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.read');

    const policies = await getPolicies(tenantId);
    return NextResponse.json({ success: true, data: policies });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.policies.manage');

    const body = await parseJson(request, policyUpdateSchema);
    const result = await upsertPolicies(tenantId, body.policies as never, context.userId);
    recordAudit(context, 'settings_change', 'hostel_policies', tenantId, { version: result.version });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
