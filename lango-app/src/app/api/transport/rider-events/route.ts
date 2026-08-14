import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';
import { db } from '@/libs/DB';
import { transportRiderEvents } from '@/features/transport/models/transport-schema';
import { and, eq } from 'drizzle-orm';

const createRiderEventSchema = z.object({
  tripId: z.string().uuid('Le trajet est requis.'),
  studentId: z.string().min(1, 'L\'élève est requis.'),
  stopId: z.string().uuid('L\'arrêt est requis.'),
  eventType: z.enum(['boarded', 'alighted', 'missed', 'absent', 'override']),
  verificationMethod: z.enum(['qr_scan', 'nfc', 'manual', 'override']).default('qr_scan'),
  deviceId: z.string().optional().nullable(),
  exceptionReason: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.boarding.manage');

    const url = new URL(request.url);
    const tripId = url.searchParams.get('tripId');
    const studentId = url.searchParams.get('studentId');

    const conditions = [eq(transportRiderEvents.tenantId, tenantId)];
    if (tripId) {
      conditions.push(eq(transportRiderEvents.tripId, tripId));
    }
    if (studentId) {
      conditions.push(eq(transportRiderEvents.studentId, studentId));
    }

    const events = await db
      .select()
      .from(transportRiderEvents)
      .where(and(...conditions))
      .orderBy(transportRiderEvents.eventTimestamp);

    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'guard']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.boarding.manage');

    const body = await parseJson(request, createRiderEventSchema);

    const event = await TransportService.recordRiderEvent(tenantId, {
      ...body,
      actorUserId: context.userId,
    });

    recordAudit(context, 'create', 'transport_rider_event', event.id, {
      tripId: body.tripId,
      studentId: body.studentId,
      eventType: body.eventType,
    });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
