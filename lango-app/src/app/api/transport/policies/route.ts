import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

const policySchema = z.object({
  maxCapacityMarginPercent: z.number().int().min(0).max(100).optional(),
  requireSafeHandoffYoungerStudents: z.boolean().optional(),
  handoffAgeThresholdYears: z.number().int().min(0).max(18).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.read');

    const data = await TransportService.getPolicies(tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.policy.manage');

    const body = await parseJson(request, policySchema);
    const data = await TransportService.upsertPolicies(tenantId, body);

    recordAudit(context, 'settings_change', 'transport_policies', tenantId, { ...body });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
