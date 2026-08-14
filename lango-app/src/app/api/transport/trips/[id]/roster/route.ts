import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { transportRiderEvents, transportTripRosterSnapshots } from '@/features/transport/models/transport-schema';
import { user } from '@/models/Schema';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.trip.read');

    const { id: tripId } = await params;

    const roster = await db
      .select({
        rosterId: transportTripRosterSnapshots.id,
        studentId: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        pickupStopId: transportTripRosterSnapshots.pickupStopId,
        dropoffStopId: transportTripRosterSnapshots.dropoffStopId,
        direction: transportTripRosterSnapshots.direction,
        allocatedStatus: transportTripRosterSnapshots.allocatedStatus,
      })
      .from(transportTripRosterSnapshots)
      .innerJoin(user, and(eq(transportTripRosterSnapshots.studentId, user.id), eq(user.tenantId, tenantId as any)))
      .where(and(eq(transportTripRosterSnapshots.tripId, tripId), eq(transportTripRosterSnapshots.tenantId, tenantId)));

    const events = await db
      .select()
      .from(transportRiderEvents)
      .where(and(eq(transportRiderEvents.tripId, tripId), eq(transportRiderEvents.tenantId, tenantId)))
      .orderBy(transportRiderEvents.eventTimestamp);

    return NextResponse.json({
      success: true,
      data: {
        roster,
        events,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
