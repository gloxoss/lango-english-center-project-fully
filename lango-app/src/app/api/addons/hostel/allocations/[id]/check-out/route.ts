import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { checkOutAllocation } from '@/features/hostel/services/allocation-service';

const checkOutSchema = z.object({
  // Controlled test hook (T6): forces the finance adapter to fail so the
  // "Finance down must not block departure" path is verifiable by hand.
  simulateFinanceFailure: z.boolean().optional(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.allocation.manage');

    const { id } = await params;
    const body = await parseJson(request, checkOutSchema);
    const allocation = await checkOutAllocation(tenantId, context.userId, id, {
      simulateFinanceFailure: body.simulateFinanceFailure,
    });
    recordAudit(context, 'update', 'hostel_allocation', id, { action: 'check_out', simulateFinanceFailure: body.simulateFinanceFailure ?? false });
    return NextResponse.json({ success: true, data: allocation });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
