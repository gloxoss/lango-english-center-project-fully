import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/transport/drivers/route';
import { db } from '@/libs/DB';
import { addonEntitlements, tenants, user } from '@/models/Schema';
import type { RequestContext } from '@/libs/api/context';

// Regression: GET /api/transport/drivers returned 500 for every tenant.
//
// The route read the staff list itself with a hand-written role list that
// included 'driver' — a value the postgres `role` enum does not have (see
// APP_ROLES / the role pgEnum). Postgres rejects the entire IN list with 22P02,
// so the handler died before reading a row and the drivers page showed nothing.
// The route now delegates to TransportService.getDrivers, which owns the
// eligible-role list.
//
// The test asserts the real role list resolves, which is the thing that broke:
// a mocked DB would have hidden it, because the failure was Postgres rejecting
// the enum literal, not JavaScript.
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

const dbReachable = Boolean(process.env.DATABASE_URL);
const tenantId = crypto.randomUUID();
const ADMIN_ID = `USR-A-${crypto.randomUUID()}`;
const GUARD_ID = `USR-G-${crypto.randomUUID()}`;

async function setContext(value: RequestContext) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue(value);
}

function req(): Promise<Response> {
  return GET(new Request('http://localhost/api/transport/drivers'));
}

describe.skipIf(!dbReachable)('GET /api/transport/drivers', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Drivers Test', slug: `drv-${tenantId}` });
    await db.insert(user).values([
      { id: ADMIN_ID, tenantId, name: 'Admin Test', email: `ad-${tenantId}@test.local`, role: 'school_admin', phone: '+212600000000' },
      { id: GUARD_ID, tenantId, name: 'Guard Test', email: `gu-${tenantId}@test.local`, role: 'guard' },
    ]);
    await db.insert(addonEntitlements).values({ tenantId, addonId: 'transport', isEnabled: true });
    await setContext({
      userId: ADMIN_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Admin Test',
      email: `ad-${tenantId}@test.local`,
    } as RequestContext);
  });

  afterAll(async () => {
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('lists eligible staff without tripping the role enum', async () => {
    const res = await req();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    const ids = json.data.map((d: { id: string }) => d.id);
    expect(ids).toContain(ADMIN_ID);
    expect(ids).toContain(GUARD_ID);
  });

  it('returns the phone (the old handler selected four columns and always sent null)', async () => {
    const res = await req();
    const json = await res.json();
    const admin = json.data.find((d: { id: string }) => d.id === ADMIN_ID);
    expect(admin.phone).toBe('+212600000000');
  });

  it('never returns a role the database cannot store', async () => {
    const res = await req();
    const json = await res.json();
    const roles = new Set(json.data.map((d: { role: string }) => d.role));
    // The literal that caused the 500 must not reappear as a filter value.
    expect(roles.has('driver')).toBe(false);
    for (const r of roles) {
      expect(['super_admin', 'school_admin', 'teacher', 'accountant', 'student', 'alumni', 'parent', 'receptionist', 'guard', 'librarian']).toContain(r);
    }
  });

  it('denies the request when the transport add-on is not activated', async () => {
    const bareTenantId = crypto.randomUUID();
    await db.insert(tenants).values({ id: bareTenantId, name: 'No Transport', slug: `nt-${bareTenantId}` });
    await db.insert(user).values({
      id: `USR-NT-${bareTenantId}`, tenantId: bareTenantId, name: 'Admin NT', email: `nt-${bareTenantId}@test.local`, role: 'school_admin',
    });
    await setContext({
      userId: `USR-NT-${bareTenantId}`,
      tenantId: bareTenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Admin NT',
      email: `nt-${bareTenantId}@test.local`,
    } as RequestContext);

    const res = await req();
    expect(res.status).toBe(403);

    await db.delete(user).where(eq(user.tenantId, bareTenantId));
    await db.delete(tenants).where(eq(tenants.id, bareTenantId));

    // Restore the entitled context for any later test.
    await setContext({
      userId: ADMIN_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Admin Test',
      email: `ad-${tenantId}@test.local`,
    } as RequestContext);
  });
});
