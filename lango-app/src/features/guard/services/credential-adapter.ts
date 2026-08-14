// Signed credential adapter — the ONLY guard code path that touches a badge.
// It reuses the exact HMAC algorithm/secret of attendance (badge-crypto.ts), so
// there is provably no second credential format. Failure responses are uniform
// (`{ ok: false }`); the precise rejection reason lives only in the server-side
// guardGateScanEvents evidence row.
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { identityBadgeCredentials, user } from '@/models/Schema';
import {
  guardGateScanEvents,
  guardGates,
  guardPickupAuthorizations,
  guardVisits,
} from '@/features/guard/models/guard-schema';

export type PersonSummary = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  subjectType: 'student' | 'staff' | 'visitor';
  label: 'Élève' | 'Personnel' | 'Visiteur';
};

export type GateVerifyResult =
  | {
      ok: true;
      resultStatus: 'accepted';
      context: 'student_entry' | 'student_pickup' | 'staff' | 'visitor';
      direction: 'entry' | 'exit';
      person: PersonSummary;
      visitId?: string;
    }
  | {
      ok: true;
      resultStatus: 'already_processed';
      context: null;
      direction: 'entry' | 'exit';
      person: null;
    }
  | { ok: false };

export type GateVerifyInput = {
  rawToken: string;
  tenantId: string;
  gateId: string;
  gateDirection: 'entry' | 'exit' | 'both';
  direction: 'entry' | 'exit';
  deviceId?: string | null;
  kioskSessionId?: string | null;
  idempotencyKey?: string | null;
  actorId: string;
};

export type ScanEvidenceInsert = {
  tenantId: string;
  kioskSessionId?: string | null;
  gateId: string;
  deviceId?: string | null;
  direction: 'entry' | 'exit';
  credentialId?: string | null;
  subjectUserId?: string | null;
  visitId?: string | null;
  subjectType?: 'student' | 'staff' | 'visitor' | null;
  resultStatus: 'accepted' | 'rejected' | 'already_processed' | 'released';
  rejectionReason?: string | null;
  idempotencyKey?: string | null;
  actorId: string;
};

export async function insertScanEvidence(input: ScanEvidenceInsert): Promise<void> {
  await db.insert(guardGateScanEvents).values({
    tenantId: input.tenantId,
    kioskSessionId: input.kioskSessionId ?? null,
    gateId: input.gateId,
    deviceId: input.deviceId ?? null,
    direction: input.direction,
    credentialId: input.credentialId ?? null,
    subjectType: input.subjectType ?? null,
    studentId: input.subjectUserId ?? null,
    visitId: input.visitId ?? null,
    resultStatus: input.resultStatus,
    rejectionReason: input.rejectionReason ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    actorId: input.actorId,
  });
}

async function recordScanEvent(
  input: GateVerifyInput,
  resultStatus: 'accepted' | 'rejected' | 'already_processed',
  rejectionReason: string | null,
  extra: {
    credentialId?: string | null;
    subjectUserId?: string | null;
    visitId?: string | null;
    subjectType?: 'student' | 'staff' | 'visitor' | null;
    idempotencyKey?: string | null;
  },
): Promise<void> {
  await insertScanEvidence({
    tenantId: input.tenantId,
    kioskSessionId: input.kioskSessionId ?? null,
    gateId: input.gateId,
    deviceId: input.deviceId ?? null,
    direction: input.direction,
    credentialId: extra.credentialId ?? null,
    subjectUserId: extra.subjectUserId ?? null,
    visitId: extra.visitId ?? null,
    subjectType: extra.subjectType ?? null,
    resultStatus,
    rejectionReason,
    idempotencyKey: extra.idempotencyKey ?? null,
    actorId: input.actorId,
  });
}

export async function verifyGateCredential(input: GateVerifyInput): Promise<GateVerifyResult> {
  const nowIso = new Date().toISOString();
  const now = new Date();

  const genericFail = async (reason: string, extra: Parameters<typeof recordScanEvent>[3] = {}): Promise<{ ok: false }> => {
    await recordScanEvent(input, 'rejected', reason, extra);
    return { ok: false };
  };

  // Direction sanity: a gate configured as entry-only cannot admit an exit scan.
  if (input.gateDirection !== 'both' && input.gateDirection !== input.direction) {
    return genericFail('WRONG_DIRECTION');
  }

  const tokenHash = computeHmacHash(input.rawToken);

  // Replay by idempotency key: the canonical evidence row keeps the key; a replay
  // is recorded as its own already_processed row with a null key so the partial
  // unique index is never violated. No double side-effect.
  if (input.idempotencyKey) {
    const [prior] = await db
      .select({ id: guardGateScanEvents.id })
      .from(guardGateScanEvents)
      .where(and(
        eq(guardGateScanEvents.tenantId, input.tenantId),
        eq(guardGateScanEvents.idempotencyKey, input.idempotencyKey),
      ))
      .limit(1);
    if (prior) {
      await recordScanEvent(input, 'already_processed', 'REPLAYED', { idempotencyKey: null });
      return {
        ok: true,
        resultStatus: 'already_processed',
        context: null,
        direction: input.direction,
        person: null,
      };
    }
  }

  // Resolve strictly by (tenantId, tokenHash) — never by name or id.
  const [badge] = await db
    .select()
    .from(identityBadgeCredentials)
    .where(and(
      eq(identityBadgeCredentials.tenantId, input.tenantId),
      eq(identityBadgeCredentials.tokenHash, tokenHash),
    ))
    .limit(1);

  if (!badge) {
    return genericFail('INVALID_CREDENTIAL');
  }

  const expired = badge.expiresAt ? now.getTime() >= new Date(badge.expiresAt).getTime() : false;
  if (badge.status !== 'active' || badge.revokedAt || expired) {
    // Uniform failure for revoked/expired/replaced/disabled alike.
    return genericFail('BADGE_NOT_ACTIVE', { credentialId: badge.id, subjectUserId: badge.userId, subjectType: badge.subjectType });
  }

  // Visitor: must map to an approved/checked-in visit bound to this credential.
  if (badge.subjectType === 'visitor') {
    const [visit] = await db
      .select()
      .from(guardVisits)
      .where(and(
        eq(guardVisits.tenantId, input.tenantId),
        eq(guardVisits.badgeCredentialId, badge.id),
        inArray(guardVisits.status, ['approved', 'checked_in']),
      ))
      .limit(1);
    if (!visit) {
      return genericFail('VISIT_NOT_FOUND', { credentialId: badge.id, subjectUserId: badge.userId, subjectType: 'visitor' });
    }
    const person: PersonSummary = {
      id: visit.id,
      displayName: `${visit.visitorFirstName} ${visit.visitorLastName}`.trim(),
      photoUrl: null,
      subjectType: 'visitor',
      label: 'Visiteur',
    };
    await recordScanEvent(input, 'accepted', null, {
      credentialId: badge.id,
      subjectUserId: badge.userId,
      visitId: visit.id,
      subjectType: 'visitor',
    });
    return { ok: true, resultStatus: 'accepted', context: 'visitor', direction: input.direction, person, visitId: visit.id };
  }

  // Student / staff: resolve the subject row tenant-scoped.
  const [subject] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(and(eq(user.id, badge.userId), eq(user.tenantId, input.tenantId)))
    .limit(1);
  if (!subject) {
    return genericFail('SUBJECT_NOT_FOUND', { credentialId: badge.id, subjectUserId: badge.userId, subjectType: badge.subjectType });
  }

  const subjectType = badge.subjectType === 'student' ? 'student' : 'staff';
  const label = subjectType === 'student' ? 'Élève' : 'Personnel';

  if (subjectType === 'student' && input.direction === 'exit') {
    // Plausibility check only: an active pickup authorization inside its window
    // must exist for an exit scan. The authoritative consume happens in the
    // release transaction; nothing is listed to the scanner.
    const [auth] = await db
      .select({ id: guardPickupAuthorizations.id })
      .from(guardPickupAuthorizations)
      .where(and(
        eq(guardPickupAuthorizations.tenantId, input.tenantId),
        eq(guardPickupAuthorizations.studentId, badge.userId),
        eq(guardPickupAuthorizations.status, 'active'),
        sql`${guardPickupAuthorizations.authorizedFrom} <= ${nowIso} AND ${guardPickupAuthorizations.authorizedUntil} > ${nowIso}`,
      ))
      .limit(1);
    if (!auth) {
      return genericFail('NO_PICKUP_AUTH', { credentialId: badge.id, subjectUserId: badge.userId, subjectType });
    }
  }

  const person: PersonSummary = {
    id: subject.id,
    displayName: subject.name,
    photoUrl: subject.image,
    subjectType,
    label,
  };
  await recordScanEvent(input, 'accepted', null, {
    credentialId: badge.id,
    subjectUserId: subject.id,
    subjectType,
  });

  const context = subjectType === 'student'
    ? (input.direction === 'entry' ? 'student_entry' : 'student_pickup')
    : 'staff';
  return { ok: true, resultStatus: 'accepted', context, direction: input.direction, person };
}

// Evidence trail (§7.1): never raw tokens, never token hashes, never contact
// details. Cap 100 so a single page cannot dump the whole history.
export async function listScanEvidence(context: RequestContext, opts: {
  kioskSessionId?: string | null;
  gateId?: string | null;
  from?: string | null;
  to?: string | null;
  resultStatus?: string | null;
}): Promise<Array<{
  id: string;
  scannedAt: string;
  direction: 'entry' | 'exit';
  resultStatus: string;
  subjectType: string | null;
  gateName: string | null;
  operatorName: string | null;
}>> {
  const tenantId = requireTenant(context);
  const conditions = [eq(guardGateScanEvents.tenantId, tenantId)];
  if (opts.kioskSessionId) conditions.push(eq(guardGateScanEvents.kioskSessionId, opts.kioskSessionId));
  if (opts.gateId) conditions.push(eq(guardGateScanEvents.gateId, opts.gateId));
  if (opts.from) conditions.push(gte(guardGateScanEvents.scannedAt, opts.from));
  if (opts.to) conditions.push(sql`${guardGateScanEvents.scannedAt} <= ${opts.to}`);
  if (opts.resultStatus) conditions.push(eq(guardGateScanEvents.resultStatus, opts.resultStatus));

  const rows = await db
    .select({
      id: guardGateScanEvents.id,
      scannedAt: guardGateScanEvents.scannedAt,
      direction: guardGateScanEvents.direction,
      resultStatus: guardGateScanEvents.resultStatus,
      subjectType: guardGateScanEvents.subjectType,
      gateName: guardGates.gateName,
      operatorName: user.name,
    })
    .from(guardGateScanEvents)
    .leftJoin(guardGates, eq(guardGateScanEvents.gateId, guardGates.id))
    .leftJoin(user, eq(guardGateScanEvents.actorId, user.id))
    .where(and(...conditions))
    .orderBy(desc(guardGateScanEvents.scannedAt))
    .limit(100);

  return rows.map(r => ({ ...r, direction: r.direction as 'entry' | 'exit' }));
}
