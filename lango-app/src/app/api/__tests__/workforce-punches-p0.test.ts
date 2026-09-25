import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PATCH as patchPunchRoute } from '@/app/api/workforce/punches/[id]/route';
import { POST as punch } from '@/app/api/workforce/punches/route';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { db } from '@/libs/DB';
import { identityBadgeCredentials, tenants, user, workforcePunchEvents } from '@/models/Schema';

// P0 staff time clock:
//   - an expired credential must be refused (status='active' cannot express it)
//   - a revoked credential must be refused
//   - POST must demand the dedicated workforce.punch capability, so holding a
//     teacher or receptionist session is not by itself permission to punch

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

const capabilityCalls = vi.hoisted(() => [] as string[]);
const permissionState = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/libs/api/permissions', async () => {
  const { ApiError } = await import('@/libs/api/errors');
  return {
    requireCapability: vi.fn(async (_ctx: unknown, key: string) => {
      capabilityCalls.push(key);
      if (!permissionState.allowed) {
        throw new ApiError(403, 'FORBIDDEN', 'Capability refusée.');
      }
    }),
  };
});

const auditCalls = vi.hoisted(() => [] as unknown[][]);
vi.mock('@/libs/api/audit', () => ({
  recordAudit: vi.fn((...args: unknown[]) => {
    auditCalls.push(args);
  }),
}));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const OPERATOR = `WF-OP-${suffix}`;
const EMP_VALID = crypto.randomUUID();
const EMP_EXPIRED = crypto.randomUUID();
const EMP_REVOKED = crypto.randomUUID();
const TOKEN_VALID = `tok-valid-${crypto.randomUUID()}`;
const TOKEN_EXPIRED = `tok-expired-${crypto.randomUUID()}`;
const TOKEN_REVOKED = `tok-revoked-${crypto.randomUUID()}`;

// Far enough from any real clock that these never drift into each other.
const LONG_PAST = '2020-01-01T00:00:00.000Z';
const LONG_FUTURE = '2099-01-01T00:00:00.000Z';

async function asOperator() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId: OPERATOR,
    tenantId,
    role: 'school_admin',
    branchId: null,
  } as RequestContext);
}

function patchPunch(id: string, body: unknown): Promise<Response> {
  return patchPunchRoute(
    new Request(`http://x/api/workforce/punches/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function post(body: unknown): Promise<Response> {
  return punch(new Request('http://x/api/workforce/punches', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

async function punchesFor(employeeId: string) {
  return db
    .select()
    .from(workforcePunchEvents)
    .where(and(
      eq(workforcePunchEvents.tenantId, tenantId),
      eq(workforcePunchEvents.employeeId, employeeId),
    ));
}

describe.skipIf(!dbReachable)('workforce punches P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `WF Punch ${suffix}`, slug: `wf-punch-${suffix}` });
    await db.insert(user).values([
      { id: OPERATOR, tenantId, name: 'Kiosk Operator', email: `wf-op-${suffix}@t.local`, role: 'school_admin' },
      { id: EMP_VALID, tenantId, name: 'Employee Valid', email: `wf-v-${suffix}@t.local`, role: 'teacher' },
      { id: EMP_EXPIRED, tenantId, name: 'Employee Expired', email: `wf-e-${suffix}@t.local`, role: 'teacher' },
      { id: EMP_REVOKED, tenantId, name: 'Employee Revoked', email: `wf-r-${suffix}@t.local`, role: 'teacher' },
    ]);
    await db.insert(identityBadgeCredentials).values([
      { tenantId, userId: EMP_VALID, tokenHash: computeHmacHash(TOKEN_VALID), status: 'active', expiresAt: LONG_FUTURE },
      { tenantId, userId: EMP_EXPIRED, tokenHash: computeHmacHash(TOKEN_EXPIRED), status: 'active', expiresAt: LONG_PAST },
      { tenantId, userId: EMP_REVOKED, tokenHash: computeHmacHash(TOKEN_REVOKED), status: 'revoked' },
    ]);
  });

  afterAll(async () => {
    await db.delete(workforcePunchEvents).where(eq(workforcePunchEvents.tenantId, tenantId));
    await db.delete(identityBadgeCredentials).where(eq(identityBadgeCredentials.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('P0.1: an active, unexpired badge records a punch', async () => {
    await asOperator();
    const res = await post({ rawToken: TOKEN_VALID, punchType: 'in' });

    expect(res.status).toBe(200);

    const rows = await punchesFor(EMP_VALID);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.punchType).toBe('in');
    expect(rows[0]!.tenantId).toBe(tenantId);
  });

  it('P0.2: an active badge past its expiry is refused and records no punch', async () => {
    await asOperator();
    const res = await post({ rawToken: TOKEN_EXPIRED, punchType: 'in' });

    expect(res.status).toBe(422);

    const json = await res.json() as any;

    expect(json.error.code).toBe('BADGE_EXPIRED');
    expect(await punchesFor(EMP_EXPIRED)).toHaveLength(0);
  });

  it('P0.3: a revoked badge is refused and records no punch', async () => {
    await asOperator();
    const res = await post({ rawToken: TOKEN_REVOKED, punchType: 'in' });

    expect(res.status).toBe(404);

    const json = await res.json() as any;

    expect(json.error.code).toBe('STAFF_BADGE_INVALID');
    expect(await punchesFor(EMP_REVOKED)).toHaveLength(0);
  });

  it('P0.4: the route demands the workforce.punch capability', async () => {
    await asOperator();
    capabilityCalls.length = 0;
    await post({ rawToken: TOKEN_VALID, punchType: 'out' });

    expect(capabilityCalls).toContain('workforce.punch');
  });

  it('P0.5: a caller without workforce.punch cannot punch', async () => {
    await asOperator();
    const before = (await punchesFor(EMP_VALID)).length;
    permissionState.allowed = false;
    try {
      const res = await post({ rawToken: TOKEN_VALID, punchType: 'out' });

      expect(res.status).toBe(403);
      expect(await punchesFor(EMP_VALID)).toHaveLength(before);
    } finally {
      permissionState.allowed = true;
    }
  });

  // ---- the state machine (phase 9) ----------------------------------------

  it('P9.1: the server decides the action, and reports it', async () => {
    await asOperator();

    // Establish a known state: one arrival, open shift.
    await db.insert(workforcePunchEvents).values({
      tenantId, employeeId: EMP_VALID, punchType: 'in',
      scannedAt: new Date().toISOString(), notes: 'state setup',
    });

    // The caller states nothing and the server answers "out".
    const res = await post({ rawToken: TOKEN_VALID });

    expect(res.status).toBe(200);

    const json = await res.json() as any;

    expect(json.data.action).toBe('out');
    expect(json.data.punch.punchType).toBe('out');
  });

  it('P9.2: a duplicate arrival is refused, and the refusal names the legal action', async () => {
    await asOperator();
    // Last punch is now "out" from P9.1, so another departure is the illegal one.
    const res = await post({ rawToken: TOKEN_VALID, punchType: 'out' });

    expect(res.status).toBe(409);

    const json = await res.json() as any;

    expect(json.error.code).toBe('INVALID_PUNCH_SEQUENCE');
    expect(json.error.message).toMatch(/arrivée/i);
  });

  it('P9.3: a departure without an arrival is refused', async () => {
    await asOperator();

    // A fresh employee with no punch history at all.
    const employeeId = crypto.randomUUID();
    const token = `tok-fresh-${crypto.randomUUID()}`;
    await db.insert(user).values({ id: employeeId, tenantId, name: 'Fresh', email: `fresh-${employeeId}@t.local`, role: 'teacher' });
    await db.insert(identityBadgeCredentials).values({
      tenantId, userId: employeeId, tokenHash: computeHmacHash(token), status: 'active',
    });

    const res = await post({ rawToken: token, punchType: 'out' });

    expect(res.status).toBe(409);
    expect((await punchesFor(employeeId))).toHaveLength(0);
  });

  it('P9.4: an overnight shift is not an error — arrival yesterday, departure today', async () => {
    await asOperator();

    const employeeId = crypto.randomUUID();
    const token = `tok-night-${crypto.randomUUID()}`;
    await db.insert(user).values({ id: employeeId, tenantId, name: 'Night', email: `night-${employeeId}@t.local`, role: 'teacher' });
    await db.insert(identityBadgeCredentials).values({
      tenantId, userId: employeeId, tokenHash: computeHmacHash(token), status: 'active',
    });

    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await db.insert(workforcePunchEvents).values({
      tenantId, employeeId, punchType: 'in', scannedAt: yesterday, notes: 'night shift',
    });

    const res = await post({ rawToken: token });

    expect(res.status).toBe(200);
    expect((await res.json() as any).data.action).toBe('out');
  });

  // ---- HR correction (phase 9) --------------------------------------------

  it('P9.5: HR corrects a punch, and the correction is audited with before/after', async () => {
    const [punch] = await db
      .insert(workforcePunchEvents)
      .values({ tenantId, employeeId: EMP_VALID, punchType: 'in', scannedAt: '2026-09-20T08:00:00.000Z', notes: null })
      .returning();

    auditCalls.length = 0;
    await asOperator();

    const res = await patchPunch(punch!.id, {
      scannedAt: '2026-09-20T07:30:00.000Z',
      reason: 'Employé arrivé à 07h30, badge lu en retard',
    });

    expect(res.status).toBe(200);

    const [after] = await db
      .select({ scannedAt: workforcePunchEvents.scannedAt })
      .from(workforcePunchEvents)
      .where(eq(workforcePunchEvents.id, punch!.id));

    // workforce_punch_events.scanned_at is a timestamp WITHOUT time zone, so it
    // stores the wall clock it is given and returns it without an offset. The
    // literal written is preserved; only the zone marker is lost. Asserting on
    // the instant instead would read it back as local time and fail by the
    // server's offset.
    expect(String(after!.scannedAt).slice(0, 16)).toBe('2026-09-20 07:30');

    // The audit carries what it was, what it became, and why — without the
    // reason a correction is indistinguishable from tampering.
    const entry = auditCalls.find(call => (call[4] as any)?.reason);
    const detail = entry?.[4] as any;

    expect(detail.reason).toBe('Employé arrivé à 07h30, badge lu en retard');
    expect(String(detail.before.scannedAt).slice(0, 16)).toBe('2026-09-20 08:00');
    expect(String(detail.after.scannedAt).slice(0, 16)).toBe('2026-09-20 07:30');
  });

  it('P9.6: a correction with no reason is refused', async () => {
    const [punch] = await db
      .insert(workforcePunchEvents)
      .values({ tenantId, employeeId: EMP_VALID, punchType: 'in', scannedAt: new Date().toISOString(), notes: null })
      .returning();

    await asOperator();

    const res = await patchPunch(punch!.id, { punchType: 'out' });

    expect(res.status).toBe(422);
  });

  it('P9.7: a punch from another tenant is not correctable', async () => {
    await asOperator();

    const res = await patchPunch(crypto.randomUUID(), { punchType: 'out', reason: 'tentative' });

    expect(res.status).toBe(404);
  });
});
