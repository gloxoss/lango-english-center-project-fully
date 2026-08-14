import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { transportStudentAllocations } from '@/features/transport/models/transport-schema';
import { TransportService } from '@/features/transport/services/transport-service';
import { and, eq } from 'drizzle-orm';

const updateAllocationSchema = z.object({
  status: z.enum(['active', 'waitlisted', 'suspended', 'cancelled']).optional(),
  effectiveEndDate: z.string().optional().nullable(),
  assistanceNotes: z.string().optional().nullable(),
  pickupStopId: z.string().uuid().optional(),
  dropoffStopId: z.string().uuid().optional(),
  effectiveStartDate: z.string().optional(),
  direction: z.enum(['morning', 'afternoon', 'both']).optional(),
}).strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.assignment.read');

    const { id } = await params;
    const [allocation] = await db
      .select()
      .from(transportStudentAllocations)
      .where(and(eq(transportStudentAllocations.id, id), eq(transportStudentAllocations.tenantId, tenantId)))
      .limit(1);

    if (!allocation) {
      throw new ApiError(404, 'NOT_FOUND', 'Affectation introuvable.');
    }

    return NextResponse.json({ success: true, data: allocation });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.assignment.manage');

    const { id } = await params;
    const body = await parseJson(request, updateAllocationSchema);

    const updated = await TransportService.updateAllocation(tenantId, id, body);

    recordAudit(context, 'update', 'transport_allocation', id, { changes: body });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.assignment.manage');

    const { id } = await params;
    const [existing] = await db
      .select()
      .from(transportStudentAllocations)
      .where(and(eq(transportStudentAllocations.id, id), eq(transportStudentAllocations.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Affectation introuvable.');
    }

    // Cancel allocation idempotently
    await db
      .update(transportStudentAllocations)
      .set({
        status: 'cancelled',
        effectiveEndDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(transportStudentAllocations.id, id), eq(transportStudentAllocations.tenantId, tenantId)));

    recordAudit(context, 'delete', 'transport_allocation', id, {});

    return NextResponse.json({ success: true, message: 'Affectation annulée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
