import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

const createIncidentSchema = z.object({
  tripId: z.string().uuid().optional().nullable(),
  vehicleId: z.string().uuid().optional().nullable(),
  driverId: z.string().optional().nullable(),
  incidentType: z.enum([
    'missed_pickup',
    'wrong_stop',
    'student_not_boarded',
    'unauthorized_pickup_attempt',
    'vehicle_breakdown',
    'late_route',
    'safeguarding',
    'medical',
    'other',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  title: z.string().min(1, 'Le titre est requis.'),
  description: z.string().optional().nullable(),
  assignedResponderUserId: z.string().optional().nullable(),
  safeguardingRedactedNotes: z.string().optional().nullable(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.incident.read');

    const incidents = await TransportService.getIncidents(tenantId, context.role);
    return NextResponse.json({ success: true, data: incidents });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'guard', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.incident.manage');

    const body = await parseJson(request, createIncidentSchema);

    // Safeguarding note capability check
    if (body.safeguardingRedactedNotes) {
      await requireCapability(context, 'transport.safeguarding.read');
    }

    const incident = await TransportService.createIncident(tenantId, {
      ...body,
      reportedByUserId: context.userId,
    });

    recordAudit(context, 'create', 'transport_incident', incident.id, {
      incidentType: body.incidentType,
      severity: body.severity,
    });

    return NextResponse.json({ success: true, data: incident }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
