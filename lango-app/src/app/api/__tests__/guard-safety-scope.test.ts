import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Guard / security scope regression suite (AUD-SAFETY-01).
//
// Covers:
//   - legacy gate direction values ('in'/'out') no longer break badge scans;
//   - the scan idempotency key is persisted so a replay is deduplicated;
//   - visitor check-in refuses a gate owned by another tenant;
//   - the guard home expected list is branch-scoped and uses the Casablanca day;
//   - emergency activation stays leadership-only while acknowledgement is open
//     to guards.

let currentSessionUserId: string | null = null;

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { casablancaDayBoundsUtc, casablancaTodayIso, casablancaWallTimeUtc } = await import('@/libs/finance/today');
const { issueBadge } = await import('@/libs/api/badge-service');
const {
  branches,
  tenants,
  user,
} = await import('@/models/Schema');
const {
  guardAssignments,
  guardGates,
  guardShifts,
  guardVisits,
  guardVisitorInvitations,
} = await import('@/features/guard/models/guard-schema');
const { normalizeGateDirection } = await import('@/features/guard/services/gates-service');
const { verifyGateCredential } = await import('@/features/guard/services/credential-adapter');
const { checkInVisit, checkOutVisit } = await import('@/features/guard/services/visitors-service');
const { getExpectedOverview } = await import('@/features/guard/services/home-service');
const emergencyActivateRoute = await import('@/app/api/guard/emergency/activate/route');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('guard safety scope', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);

  const guardId = `USR-GSS-GUARD-${suffix}`;
  const adminId = `USR-GSS-ADMIN-${suffix}`;
  const studentId = `USR-GSS-STU-${suffix}`;

  let branchA = '';
  let branchB = '';
  let gateA = '';
  let gateB = '';
  let foreignGateId = '';
  let shiftId = '';
  let assignmentId = '';

  function ctx(overrides: Record<string, unknown> = {}) {
    return { userId: guardId, tenantId, branchId: null, role: 'guard', ...overrides } as never;
  }

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Guard Safety Test', slug: `gss-${suffix}` },
      { id: otherTenantId, name: 'Guard Safety Other', slug: `gss-o-${suffix}` },
    ]);

    const branchRows = await db.insert(branches).values([
      { tenantId, name: 'Branch A', code: `A-${suffix}` },
      { tenantId, name: 'Branch B', code: `B-${suffix}` },
    ]).returning();
    branchA = branchRows[0]!.id;
    branchB = branchRows[1]!.id;

    await db.insert(user).values([
      { id: guardId, tenantId, name: 'Test Guard', email: `gss-guard-${suffix}@t.local`, role: 'guard', userStatus: 'active' },
      { id: adminId, tenantId, name: 'Test Admin', email: `gss-admin-${suffix}@t.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentId, tenantId, name: 'Test Student', email: `gss-stu-${suffix}@t.local`, role: 'student', userStatus: 'active' },
    ]);

    // Legacy direction on purpose — the scan path must normalize it.
    const [gate] = await db.insert(guardGates).values({
      tenantId,
      branchId: branchA,
      gateCode: `GA-${suffix}`,
      gateName: 'Gate A',
      direction: 'in',
    }).returning();
    gateA = gate!.id;

    const [gateBRow] = await db.insert(guardGates).values({
      tenantId,
      branchId: branchB,
      gateCode: `GAB-${suffix}`,
      gateName: 'Gate B',
      direction: 'both',
    }).returning();
    gateB = gateBRow!.id;

    const [foreignGate] = await db.insert(guardGates).values({
      tenantId: otherTenantId,
      gateCode: `GB-${suffix}`,
      gateName: 'Foreign Gate',
      direction: 'entry',
    }).returning();
    foreignGateId = foreignGate!.id;

    const [shift] = await db.insert(guardShifts).values({
      tenantId,
      branchId: branchA,
      name: 'Test Shift',
      startTime: '06:00',
      endTime: '14:00',
    }).returning();
    shiftId = shift!.id;

    const [assignment] = await db.insert(guardAssignments).values({
      tenantId,
      branchId: branchA,
      guardUserId: guardId,
      gateId: gateA,
      shiftId,
      effectiveFrom: '2025-09-01T00:00:00.000Z',
      status: 'active',
    }).returning();
    assignmentId = assignment!.id;

    // Invitations: own branch, other branch, tenant-wide (null branch).
    const today = casablancaTodayIso();
    const expectedDate = `${today}T12:00:00.000Z`;
    await db.insert(guardVisitorInvitations).values([
      { tenantId, branchId: branchA, visitorFirstName: 'OwnBranch', visitorLastName: 'One', purpose: 'audit', hostId: adminId, expectedDate, expectedStart: '10:00', expectedEnd: '11:00', status: 'approved', createdById: adminId },
      { tenantId, branchId: branchB, visitorFirstName: 'OtherBranch', visitorLastName: 'Two', purpose: 'audit', hostId: adminId, expectedDate, expectedStart: '10:00', expectedEnd: '11:00', status: 'approved', createdById: adminId },
      { tenantId, branchId: null, visitorFirstName: 'TenantWide', visitorLastName: 'Three', purpose: 'audit', hostId: adminId, expectedDate, expectedStart: '10:00', expectedEnd: '11:00', status: 'approved', createdById: adminId },
    ]);
  });

  afterAll(async () => {
    await db.delete(guardVisitorInvitations).where(eq(guardVisitorInvitations.tenantId, tenantId));
    await db.delete(guardVisits).where(eq(guardVisits.tenantId, tenantId));
    await db.delete(guardAssignments).where(eq(guardAssignments.tenantId, tenantId));
    await db.delete(guardShifts).where(eq(guardShifts.tenantId, tenantId));
    await db.delete(guardGates).where(eq(guardGates.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
    await db.delete(guardGates).where(eq(guardGates.tenantId, otherTenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('normalizes legacy gate directions', () => {
    expect(normalizeGateDirection('in')).toBe('entry');
    expect(normalizeGateDirection('out')).toBe('exit');
    expect(normalizeGateDirection('entry')).toBe('entry');
    expect(normalizeGateDirection('exit')).toBe('exit');
    expect(normalizeGateDirection('both')).toBe('both');
    expect(normalizeGateDirection(null)).toBe('both');
  });

  it('computes the Casablanca day bounds as UTC instants', () => {
    // 2026-09-24 23:30 UTC is 2026-09-25 00:30 in Casablanca (+01).
    const bounds = casablancaDayBoundsUtc(new Date('2026-09-24T23:30:00.000Z'));

    expect(bounds.start.toISOString()).toBe('2026-09-24T23:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-09-25T23:00:00.000Z');

    const shiftEnd = casablancaWallTimeUtc('2026-09-24', '14:00');

    expect(shiftEnd.toISOString()).toBe('2026-09-24T13:00:00.000Z');
  });

  it('accepts an entry scan on a gate stored with the legacy direction', async () => {
    const { rawToken } = await issueBadge({
      tenantId,
      userId: studentId,
      subjectType: 'student',
      issuerId: adminId,
    });

    const result = await verifyGateCredential({
      rawToken,
      tenantId,
      gateId: gateA,
      gateDirection: 'in', // legacy stored value
      direction: 'entry',
      actorId: guardId,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.resultStatus).toBe('accepted');
    }
  });

  it('deduplicates a replayed scan by its idempotency key', async () => {
    const { rawToken } = await issueBadge({
      tenantId,
      userId: studentId,
      subjectType: 'staff',
      issuerId: adminId,
    });
    const key = crypto.randomUUID();
    const input = {
      rawToken,
      tenantId,
      gateId: gateA,
      gateDirection: 'entry',
      direction: 'entry' as const,
      actorId: guardId,
      idempotencyKey: key,
    };

    const first = await verifyGateCredential(input);

    expect(first.ok).toBe(true);

    if (first.ok) {
      expect(first.resultStatus).toBe('accepted');
    }

    const replay = await verifyGateCredential(input);

    expect(replay.ok).toBe(true);

    if (replay.ok) {
      expect(replay.resultStatus).toBe('already_processed');
      expect(replay.person).toBeNull();
    }
  });

  it('refuses visitor check-in at a gate owned by another tenant', async () => {
    const [visit] = await db.insert(guardVisits).values({
      tenantId,
      visitorFirstName: 'Cross',
      visitorLastName: 'Tenant',
      purpose: 'audit',
      status: 'approved',
      createdById: guardId,
    }).returning();

    await expect(checkInVisit(ctx(), visit!.id, { gateId: foreignGateId }))
      .rejects
      .toMatchObject({ status: 403, code: 'GATE_INVALID' });
  });

  // ---------------------------------------------------------------------------
  // S-08 — branch boundary on visitor check-in/check-out.
  // Rule (platform branch model): a principal pinned to a branch may only
  // reference that branch; a principal with no branch acts tenant-wide; a
  // tenant-wide gate (branchId NULL) is shared infrastructure.
  // ---------------------------------------------------------------------------

  async function seedVisit(branchId: string | null, name: string) {
    const [row] = await db.insert(guardVisits).values({
      tenantId,
      branchId,
      visitorFirstName: name,
      visitorLastName: 'Branch',
      purpose: 'audit',
      status: 'approved',
      createdById: guardId,
    }).returning();
    return row!;
  }

  it('allows a branch-pinned actor to check in and out an own-branch visit, replay-safe', async () => {
    const visit = await seedVisit(branchA, 'SameBranch');

    const first = await checkInVisit(ctx({ branchId: branchA }), visit.id, { gateId: gateA, idempotencyKey: crypto.randomUUID() });

    expect(first.replayed).toBe(false);

    const [persisted] = await db.select({ branchId: guardVisits.branchId, gateId: guardVisits.gateId })
      .from(guardVisits)
      .where(eq(guardVisits.id, visit.id))
      .limit(1);

    expect(persisted!.branchId).toBe(branchA);
    expect(persisted!.gateId).toBe(gateA);

    const replay = await checkInVisit(ctx({ branchId: branchA }), visit.id, { gateId: gateA });

    expect(replay.replayed).toBe(true);

    const out = await checkOutVisit(ctx({ branchId: branchA }), visit.id, { gateId: gateA, idempotencyKey: crypto.randomUUID() });

    expect(out.replayed).toBe(false);

    const outReplay = await checkOutVisit(ctx({ branchId: branchA }), visit.id, { gateId: gateA });

    expect(outReplay.replayed).toBe(true);

    const [after] = await db.select({ branchId: guardVisits.branchId }).from(guardVisits).where(eq(guardVisits.id, visit.id)).limit(1);

    expect(after!.branchId).toBe(branchA);
  });

  it('refuses a foreign-branch gate for a branch-pinned actor', async () => {
    const visit = await seedVisit(branchA, 'GateTamper');

    await expect(checkInVisit(ctx({ branchId: branchA }), visit.id, { gateId: gateB }))
      .rejects
      .toMatchObject({ status: 403, code: 'BRANCH_MISMATCH' });

    const [unchanged] = await db.select({ status: guardVisits.status }).from(guardVisits).where(eq(guardVisits.id, visit.id)).limit(1);

    expect(unchanged!.status).toBe('approved');
  });

  it('refuses a foreign-branch visit for a branch-pinned actor', async () => {
    const visit = await seedVisit(branchB, 'VisitTamper');

    await expect(checkInVisit(ctx({ branchId: branchA }), visit.id, { gateId: gateA }))
      .rejects
      .toMatchObject({ status: 403, code: 'BRANCH_MISMATCH' });

    const [unchanged] = await db.select({ status: guardVisits.status }).from(guardVisits).where(eq(guardVisits.id, visit.id)).limit(1);

    expect(unchanged!.status).toBe('approved');
  });

  it('lets a tenant-wide actor (no branch) operate across branches within the tenant', async () => {
    const visit = await seedVisit(branchB, 'TenantWide');

    const result = await checkInVisit(ctx({ branchId: null }), visit.id, { gateId: gateB });

    expect(result.replayed).toBe(false);
  });

  it('branch-scopes the expected visitor list and keeps the guard assignment', async () => {
    const overview = await getExpectedOverview(ctx({ branchId: branchA }));

    const names = overview.expected.visitors.map((v: { visitorFirstName: string }) => v.visitorFirstName);

    expect(names).toContain('OwnBranch');
    expect(names).toContain('TenantWide');
    expect(names).not.toContain('OtherBranch');

    const shiftPayload = overview.shift as {
      assignment: { id: string };
      gate: { id: string } | null;
      shift: { id: string } | null;
    };
    const gatePayload = overview.gate as { gate: { id: string } };

    expect(shiftPayload.assignment.id).toBe(assignmentId);
    expect(shiftPayload.gate?.id).toBe(gateA);
    expect(shiftPayload.shift?.id).toBe(shiftId);
    expect(gatePayload.gate.id).toBe(gateA);
  });

  it('keeps emergency activation leadership-only', async () => {
    currentSessionUserId = guardId;
    const denied = await emergencyActivateRoute.POST(new Request('http://x/api/guard/emergency/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'guard attempt' }),
    }));

    expect(denied.status).toBe(403);

    currentSessionUserId = adminId;
    const allowed = await emergencyActivateRoute.POST(new Request('http://x/api/guard/emergency/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'test drill' }),
    }));

    expect(allowed.status).toBe(201);

    // Clean up the activation created by this test.
    const { guardEmergencyActivations } = await import('@/features/guard/models/guard-schema');
    await db.delete(guardEmergencyActivations).where(and(
      eq(guardEmergencyActivations.tenantId, tenantId),
      eq(guardEmergencyActivations.activatedById, adminId),
    ));
  });
});
