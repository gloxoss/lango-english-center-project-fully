import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

const createAllocationSchema = z.object({
  studentId: z.string().min(1, 'L\'élève est requis.'),
  routeId: z.string().uuid('L\'itinéraire est requis.'),
  pickupStopId: z.string().uuid('L\'arrêt de prise en charge est requis.'),
  dropoffStopId: z.string().uuid('L\'arrêt de dépose est requis.'),
  direction: z.enum(['morning', 'afternoon', 'both']).default('both'),
  effectiveStartDate: z.string().optional().nullable(),
  effectiveEndDate: z.string().optional().nullable(),
  serviceDays: z.array(z.string()).optional().nullable(),
  assistanceNotes: z.string().optional().nullable(),
  status: z.enum(['active', 'waitlisted', 'suspended', 'cancelled']).default('active'),
  fareReferenceId: z.string().optional().nullable(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.assignment.read');

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId') || undefined;
    const routeId = url.searchParams.get('routeId') || undefined;
    const status = url.searchParams.get('status') || undefined;

    const allocations = await TransportService.getAllocations(tenantId, { studentId, routeId, status });
    return NextResponse.json({ success: true, data: allocations });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.assignment.manage');

    const body = await parseJson(request, createAllocationSchema);
    const allocation = await TransportService.allocateStudent(tenantId, body);

    recordAudit(context, 'create', 'transport_allocation', allocation.id, {
      studentId: body.studentId,
      routeId: body.routeId,
    });

    return NextResponse.json({ success: true, data: allocation }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
