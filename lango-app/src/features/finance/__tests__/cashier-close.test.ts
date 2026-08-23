import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as closeCashier } from '@/app/api/finance/cashier-sessions/[id]/close/route';
import { POST as reconcileCashier } from '@/app/api/finance/cashier-sessions/[id]/reconcile/route';
import { POST as openOwnSession, PUT as closeOwnSession } from '@/app/api/accountant/me/cashier/route';
import { db } from '@/libs/DB';
import { cashierSessions, tenants, user } from '@/models/Schema';
import { cashierClosings } from '@/features/finance/models/student-accounting-schema';
import type { RequestContext } from '@/libs/api/context';

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

const hasDb = Boolean(process.env.DATABASE_URL);
const ADMIN_ID = `USR-ADM-${crypto.randomUUID()}`;

describe.skipIf(!hasDb)('cashier close + reconcile (Phase E)', () => {
  const tenantId = crypto.randomUUID();

  function fakeContext(): RequestContext {
    return {
      userId: ADMIN_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Cashier Tester',
      email: 'cashier.tester@example.com',
    };
  }

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue(fakeContext());
    await db.insert(tenants).values({ id: tenantId, name: 'Cashier Test', slug: `cashier-${tenantId}` });
    await db.insert(user).values({ id: ADMIN_ID, tenantId, name: 'Cashier Admin', email: `adm-${tenantId}@test.local`, role: 'school_admin' });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('closes a session via the finance route and snapshots a closing with variance', async () => {
    const [session] = await db.insert(cashierSessions).values({ tenantId, cashierId: ADMIN_ID, startingFloat: 100 }).returning();

    const res = await closeCashier(new Request('http://localhost/api/finance/cashier-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualCash: 150 }),
    }), { params: Promise.resolve({ id: session!.id }) });
    expect(res.status).toBe(200);

    const [closing] = await db.select().from(cashierClosings).where(eq(cashierClosings.cashierSessionId, session!.id));
    expect(closing).toBeDefined();
    expect(Number(closing!.expectedCash)).toBe(100);
    expect(Number(closing!.actualCash)).toBe(150);
    expect(Number(closing!.variance)).toBe(50);

    const [s2] = await db.select().from(cashierSessions).where(eq(cashierSessions.id, session!.id));
    expect(s2!.status).toBe('closed');
    expect(Number(s2!.actualCash)).toBe(150);
  });

  it('closes the accountant own session via PUT and writes a closing', async () => {
    const openRes = await openOwnSession(new NextRequest('http://localhost/api/accountant/me/cashier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startingFloat: 50 }),
    }));
    expect(openRes.status).toBe(201);
    const sessionId = (await openRes.json()).data.id;

    const closeRes = await closeOwnSession(new NextRequest('http://localhost/api/accountant/me/cashier', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualCash: 50 }),
    }));
    expect(closeRes.status).toBe(200);

    const [closing] = await db.select().from(cashierClosings).where(eq(cashierClosings.cashierSessionId, sessionId));
    expect(closing).toBeDefined();
    expect(Number(closing!.expectedCash)).toBe(50);
    expect(Number(closing!.variance)).toBe(0);
  });

  it('reconciles a closed session to reconciled', async () => {
    const [session] = await db.insert(cashierSessions).values({ tenantId, cashierId: ADMIN_ID, startingFloat: 10 }).returning();
    await closeCashier(new Request('http://localhost/api/finance/cashier-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualCash: 10 }),
    }), { params: Promise.resolve({ id: session!.id }) });

    const res = await reconcileCashier(new Request('http://localhost/api/finance/cashier-sessions', { method: 'POST' }), { params: Promise.resolve({ id: session!.id }) });
    expect(res.status).toBe(200);

    const [s2] = await db.select().from(cashierSessions).where(eq(cashierSessions.id, session!.id));
    expect(s2!.status).toBe('reconciled');
    expect(s2!.reconciledById).toBe(ADMIN_ID);
    expect(s2!.reconciledAt).toBeTruthy();
  });

  it('rejects reconciling an open session', async () => {
    const [session] = await db.insert(cashierSessions).values({ tenantId, cashierId: ADMIN_ID, startingFloat: 0 }).returning();

    const res = await reconcileCashier(new Request('http://localhost/api/finance/cashier-sessions', { method: 'POST' }), { params: Promise.resolve({ id: session!.id }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('NOT_CLOSED');
  });
});
