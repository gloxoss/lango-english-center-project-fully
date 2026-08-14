import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DELETE, POST } from '@/app/api/finance/fee-structures/route';
import { POST as PostVersion } from '@/app/api/finance/fee-structures/[id]/versions/route';
import { db } from '@/libs/DB';
import { branches, semesters, tenants } from '@/models/Schema';
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
const USER_ID = `USR-FSV-${crypto.randomUUID()}`;

describe.skipIf(!hasDb)('fee structure versions (Phase B)', () => {
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  let currentTenant = tenantA;
  let termId: string;
  let branchId: string;
  let structureId: string;

  function fakeContext(tenantId: string): RequestContext {
    return {
      userId: USER_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Fee Structure Tester',
      email: 'fee.structure.tester@example.com',
    };
  }

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockImplementation(async () => fakeContext(currentTenant));
    await db.insert(tenants).values({ id: tenantA, name: 'Fee Struct Test A', slug: `feestrc-a-${tenantA}` });
    await db.insert(tenants).values({ id: tenantB, name: 'Fee Struct Test B', slug: `feestrc-b-${tenantB}` });
    const [term] = await db
      .insert(semesters)
      .values({ tenantId: tenantA, name: 'Trimestre 1', startMonth: 9, endMonth: 12 })
      .returning();
    termId = term!.id;
    const [branch] = await db
      .insert(branches)
      .values({ tenantId: tenantA, name: 'Site Centre', code: 'CTR' })
      .returning();
    branchId = branch!.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  function postStructure(body: unknown) {
    return POST(new Request('http://localhost/api/finance/fee-structures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  function deleteStructure(id: string) {
    return DELETE(new Request(`http://localhost/api/finance/fee-structures?id=${id}`, { method: 'DELETE' }));
  }

  function postVersion(structureIdToUse: string, body: unknown) {
    return PostVersion(new Request(`http://localhost/api/finance/fee-structures/${structureIdToUse}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: structureIdToUse }) });
  }

  it('creates a structure scoped to an academic term + branch', async () => {
    currentTenant = tenantA;
    const res = await postStructure({ name: 'Frais d\'année', amount: '1500.00', academicTermId: termId, branchId, isActive: true });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.data.academicTermId).toBe(termId);
    expect(j.data.branchId).toBe(branchId);
    structureId = j.data.id;
  });

  it('stores a draft version with normalized string amount + recurrence/tax/due offset', async () => {
    const res = await postVersion(structureId, {
      componentsSnapshot: [{ name: 'Scolarité', amount: '1500.00', recurrence: 'term', taxable: true, mandatory: true, dueOffsetDays: 30 }],
      effectiveFrom: '2026-09-01',
      status: 'draft',
    });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.data.status).toBe('draft');
    const comp = j.data.componentsSnapshot[0];
    expect(comp.amount).toBe('1500.00');
    expect(comp.recurrence).toBe('term');
    expect(comp.taxable).toBe(true);
    expect(comp.dueOffsetDays).toBe(30);
    expect(j.data.publishedAt).toBeNull();
  });

  it('publishes a version with publishedAt + publisher', async () => {
    const res = await postVersion(structureId, {
      componentsSnapshot: [{ name: 'Inscription', amount: '500.00', recurrence: 'once', taxable: false, mandatory: true, dueOffsetDays: 0 }],
      effectiveFrom: '2026-09-01',
      status: 'published',
    });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.status).toBe('published');
    expect(j.data.publishedById).toBe(USER_ID);
    expect(j.data.publishedAt).toBeTruthy();
  });

  it('rejects DELETE of a structure that has versions', async () => {
    const res = await deleteStructure(structureId);
    expect(res.status).toBe(409);
    const j = await res.json();
    expect(j.error.code).toBe('FEE_STRUCTURE_VERSIONED');
  });

  it('returns 404 posting a version for a missing structure', async () => {
    const res = await postVersion(crypto.randomUUID(), {
      componentsSnapshot: [{ name: 'X', amount: '10.00', recurrence: 'once', taxable: false, mandatory: true, dueOffsetDays: 0 }],
      status: 'draft',
    });
    expect(res.status).toBe(404);
  });

  it('does not leak another tenant\'s structure (isolation)', async () => {
    currentTenant = tenantB;
    const res = await postVersion(structureId, {
      componentsSnapshot: [{ name: 'Intrusion', amount: '10.00', recurrence: 'once', taxable: false, mandatory: true, dueOffsetDays: 0 }],
      status: 'draft',
    });
    expect(res.status).toBe(404);
  });
});
