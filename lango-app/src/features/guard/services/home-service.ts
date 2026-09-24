// Gate home overview: the guard's active shift + gate, today's expected
// visitors, active pickup authorizations, and the handoff object (disabled
// until addons expose stable APIs). Identity-minimized — no directory dumps.
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { casablancaDayBoundsUtc } from '@/libs/finance/today';
import { user } from '@/models/Schema';
import {
  guardVisitorInvitations,
  guardPickupAuthorizations,
} from '@/features/guard/models/guard-schema';
import { getMyGate, getMyShift } from '@/features/guard/services/kiosk-service';
import { getHandoffStatus } from '@/features/guard/services/handoffs';

export async function getExpectedOverview(context: RequestContext) {
  const tenantId = requireTenant(context);
  const now = new Date();
  const nowIso = now.toISOString();
  // The school day is the Casablanca calendar day, not the server's local day.
  const { start: dayStart, end: dayEnd } = casablancaDayBoundsUtc(now);

  const [shift, gate, handoffs] = await Promise.all([
    getMyShift(context),
    getMyGate(context),
    getHandoffStatus(tenantId),
  ]);

  const expectedVisitors = await db
    .select({
      id: guardVisitorInvitations.id,
      visitorFirstName: guardVisitorInvitations.visitorFirstName,
      visitorLastName: guardVisitorInvitations.visitorLastName,
      purpose: guardVisitorInvitations.purpose,
      hostName: user.name,
      expectedStart: guardVisitorInvitations.expectedStart,
      expectedEnd: guardVisitorInvitations.expectedEnd,
    })
    .from(guardVisitorInvitations)
    .leftJoin(user, eq(guardVisitorInvitations.hostId, user.id))
    .where(and(
      eq(guardVisitorInvitations.tenantId, tenantId),
      eq(guardVisitorInvitations.status, 'approved'),
      // Branch-pinned staff see their branch plus tenant-wide invitations.
      context.branchId
        ? or(isNull(guardVisitorInvitations.branchId), eq(guardVisitorInvitations.branchId, context.branchId))!
        : undefined,
      gte(guardVisitorInvitations.expectedDate, dayStart.toISOString()),
      lte(guardVisitorInvitations.expectedDate, dayEnd.toISOString()),
    ))
    .orderBy(guardVisitorInvitations.expectedStart)
    .limit(20);

  const pickups = await db
    .select({
      id: guardPickupAuthorizations.id,
      studentName: user.name,
      matricule: user.matricule,
      relationshipType: guardPickupAuthorizations.relationshipType,
      authorizedUntil: guardPickupAuthorizations.authorizedUntil,
    })
    .from(guardPickupAuthorizations)
    .leftJoin(user, and(
      eq(guardPickupAuthorizations.studentId, user.id),
      eq(user.tenantId, tenantId),
    ))
    .where(and(
      eq(guardPickupAuthorizations.tenantId, tenantId),
      eq(guardPickupAuthorizations.status, 'active'),
      lte(guardPickupAuthorizations.authorizedFrom, nowIso),
      gte(guardPickupAuthorizations.authorizedUntil, nowIso),
    ))
    .orderBy(guardPickupAuthorizations.authorizedUntil)
    .limit(20);

  return {
    now: nowIso,
    shift,
    gate,
    handoffs,
    expected: {
      visitors: expectedVisitors,
      pickups,
    },
  };
}
