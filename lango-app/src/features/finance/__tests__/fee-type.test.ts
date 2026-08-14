import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST, PUT } from '@/app/api/finance/fee-types/route';
import { db } from '@/libs/DB';
import { chartOfAccounts, tenants } from '@/models/Schema';
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
const USER_ID = `USR-FT-${crypto.randomUUID()}`;

describe.skipIf(!hasDb)('fee types (Phase B)', () => {
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  let currentTenant = tenantA;
  let revenueAccountId: string;

  function fakeContext(tenantId: string): RequestContext {
    return {
      userId: USER_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Fee Type Tester',
      email: 'fee.tester@example.com',
    };
  }

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockImplementation(async () => fakeContext(currentTenant));
    await db.insert(tenants).values({ id: tenantA, name: 'Fee Type Test A', slug: `feetype-a-${tenantA}` });
    await db.insert(tenants).values({ id: tenantB, name: 'Fee Type Test B', slug: `feetype-b-${tenantB}` });
    const [acc] = await db
      .insert(chartOfAccounts)
      .values({ tenantId: tenantA, code: '71210', name: 'Frais de scolarité', accountType: 'revenue' })
      .returning();
    revenueAccountId = acc!.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  function postType(body: unknown) {
    return POST(new Request('http://localhost/api/finance/fee-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  function putType(body: unknown) {
    return PUT(new Request('http://localhost/api/finance/fee-types', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  it('creates a fee type with code, flags, revenue mapping and effective date', async () => {
    currentTenant = tenantA;
    const res = await postType({
      name: 'Scolarité',
      code: 'SCOL',
      taxable: true,
      refundable: false,
      discountable: true,
      fineable: true,
      revenueAccountId,
      effectiveFrom: '2026-09-01',
    });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.data.code).toBe('SCOL');
    expect(j.data.taxable).toBe(true);
    expect(j.data.refundable).toBe(false);
    expect(j.data.discountable).toBe(true);
    expect(j.data.fineable).toBe(true);
    expect(j.data.revenueAccountId).toBe(revenueAccountId);
    expect(j.data.effectiveFrom).toBe('2026-09-01');
    expect(j.data.isArchived).toBe(false);
  });

  it('rejects a duplicate code within the same tenant', async () => {
    currentTenant = tenantA;
    await postType({ name: 'Inscription', code: 'INSCR' });
    const res = await postType({ name: 'Réinscription', code: 'INSCR' });
    expect(res.status).toBe(409);
    const j = await res.json();
    expect(j.error.code).toBe('FEE_TYPE_CODE_EXISTS');
  });

  it('allows the same code in another tenant (isolation)', async () => {
    currentTenant = tenantB;
    const res = await postType({ name: 'Scolarité B', code: 'SCOL' });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.data.code).toBe('SCOL');
  });

  it('archives a fee type via PUT instead of deleting', async () => {
    currentTenant = tenantA;
    const res = await postType({ name: 'Ancien frais', code: 'VETU' });
    const j = await res.json();
    expect(j.success).toBe(true);
    const arch = await putType({ id: j.data.id, isArchived: true });
    expect(arch.status).toBe(200);
    const aj = await arch.json();
    expect(aj.data.isArchived).toBe(true);
  });
});
