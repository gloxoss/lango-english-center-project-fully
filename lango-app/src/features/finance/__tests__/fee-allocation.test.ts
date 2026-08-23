import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET as ListRuns } from '@/app/api/finance/fee-allocations/route';
import { POST as Preview } from '@/app/api/finance/fee-allocations/preview/route';
import { GET as GetDetail } from '@/app/api/finance/fee-allocations/[id]/route';
import { PUT as Approve } from '@/app/api/finance/fee-allocations/[id]/approve/route';
import { POST as Run } from '@/app/api/finance/fee-allocations/[id]/run/route';
import { PUT as Cancel } from '@/app/api/finance/fee-allocations/[id]/cancel/route';
import { POST as CreateStructure } from '@/app/api/finance/fee-structures/route';
import { POST as PostVersion } from '@/app/api/finance/fee-structures/[id]/versions/route';
import { db } from '@/libs/DB';
import { branches, feeAllocationTargets, invoiceEvents, invoiceItems, invoices, tenants, user } from '@/models/Schema';
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
const USER_ID = `USR-ALC-${crypto.randomUUID()}`;
const OTHER_ID = `USR-ALC-${crypto.randomUUID()}`;

describe.skipIf(!hasDb)('fee allocations (Phase C)', () => {
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  let currentTenant = tenantA;
  let currentUserId = USER_ID;
  let branchId: string;
  let versionA: string;
  let versionADraft: string;
  let s1: string;
  let s2: string;
  let s3: string;

  function fakeContext(tenantId: string, userId: string): RequestContext {
    return {
      userId,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Allocation Tester',
      email: 'allocation.tester@example.com',
    };
  }

  function jsonReq(url: string, body: unknown): Request {
    return new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function putReq(url: string): Request {
    return new Request(url, { method: 'PUT' });
  }

  function postReq(url: string): Request {
    return new Request(url, { method: 'POST' });
  }

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockImplementation(async () => fakeContext(currentTenant, currentUserId));
    await db.insert(tenants).values({ id: tenantA, name: 'Alloc Test A', slug: `alloca-${tenantA}` });
    await db.insert(tenants).values({ id: tenantB, name: 'Alloc Test B', slug: `allocb-${tenantB}` });
    const [branch] = await db.insert(branches).values({ tenantId: tenantA, name: 'Site Centre', code: 'CTR' }).returning();
    branchId = branch!.id;

    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push(`USR-STU-${crypto.randomUUID()}`);
    [s1, s2, s3] = ids as [string, string, string];
    await db.insert(user).values([
      { id: s1, tenantId: tenantA, email: 's1@test.ma', name: 'Élève Un', role: 'student', branchId, matricule: 'A001' },
      { id: s2, tenantId: tenantA, email: 's2@test.ma', name: 'Élève Deux', role: 'student', branchId, matricule: 'A002' },
      { id: s3, tenantId: tenantB, email: 's3@test.ma', name: 'Élève Trois', role: 'student' },
    ]);
    await db.insert(user).values([
      { id: USER_ID, tenantId: tenantA, email: 'alloc.author@test.ma', name: 'Allocation Tester', role: 'school_admin' },
      { id: OTHER_ID, tenantId: tenantA, email: 'alloc.approver@test.ma', name: 'Approveur Test', role: 'school_admin' },
    ]);

    // Published version (2 components) + a draft version for the 422 check.
    const structRes = await CreateStructure(jsonReq('http://localhost/api/finance/fee-structures', {
      name: 'Frais d\'année', amount: '2000.00', branchId, isActive: true,
    }));
    const struct = await structRes.json();
    const pubRes = await PostVersion(jsonReq(`http://localhost/api/finance/fee-structures/${struct.data.id}/versions`, {
      componentsSnapshot: [
        { name: 'Inscription', amount: '500.00', recurrence: 'once', taxable: true, mandatory: true, dueOffsetDays: 0 },
        { name: 'Scolarité T1', amount: '1500.00', recurrence: 'term', taxable: false, mandatory: true, dueOffsetDays: 15 },
      ],
      effectiveFrom: '2026-09-01',
      status: 'published',
    }), { params: Promise.resolve({ id: struct.data.id }) });
    versionA = (await pubRes.json()).data.id;
    const draftRes = await PostVersion(jsonReq(`http://localhost/api/finance/fee-structures/${struct.data.id}/versions`, {
      componentsSnapshot: [{ name: 'Brouillon', amount: '100.00', recurrence: 'once', taxable: false, mandatory: true, dueOffsetDays: 0 }],
      status: 'draft',
    }), { params: Promise.resolve({ id: struct.data.id }) });
    versionADraft = (await draftRes.json()).data.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  async function previewRun(body: unknown) {
    return Preview(jsonReq('http://localhost/api/finance/fee-allocations/preview', body));
  }

  it('preview derives per-student totals from published version components', async () => {
    currentTenant = tenantA;
    const res = await previewRun({
      period: 'Trimestre 1', feeStructureVersionId: versionA, studentIds: [s1, s1, s2], dueDate: '2026-10-01',
    });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.targetCount).toBe(2);
    expect(j.data.previewSummary.amountPerStudentCents).toBe('200000');
    expect(j.data.previewSummary.totalCents).toBe('400000');
    expect(j.data.previewSummary.componentCount).toBe(2);
    // max dueOffsetDays (15) shifts the invoice due date from the base date.
    expect(j.data.previewSummary.baseDueDate).toBe('2026-10-01');
    expect(j.data.previewSummary.dueDate).toBe('2026-10-16');
    expect(j.data.previewSummary.components).toHaveLength(2);
  });

  it('rejects preview against a draft version', async () => {
    currentTenant = tenantA;
    const res = await previewRun({ period: 'X', feeStructureVersionId: versionADraft, studentIds: [s1] });
    expect(res.status).toBe(422);
    const j = await res.json();
    expect(j.error.code).toBe('VERSION_NOT_PUBLISHED');
  });

  it('does not leak another tenant\'s version in preview', async () => {
    currentTenant = tenantB;
    const res = await previewRun({ period: 'X', feeStructureVersionId: versionA, studentIds: [s3] });
    expect(res.status).toBe(404);
    currentTenant = tenantA;
  });

  it('list endpoint exposes runs with target counts', async () => {
    currentTenant = tenantA;
    const res = await ListRuns(new Request('http://localhost/api/finance/fee-allocations'));
    expect(res.status).toBe(200);
    const j = await res.json();
    const run = j.data.find((r: { period: string }) => r.period === 'Trimestre 1');
    expect(run).toBeTruthy();
    expect(run.counts.pending).toBe(2);
    expect(run.runByName).toBe('Allocation Tester');
  });

  it('author cannot approve their own preview (self-approval)', async () => {
    currentTenant = tenantA;
    currentUserId = USER_ID;
    const preview = await previewRun({ period: 'Autour', feeStructureVersionId: versionA, studentIds: [s1, s2] });
    const pj = await preview.json();
    const res = await Approve(putReq(`http://localhost/api/finance/fee-allocations/${pj.data.run.id}/approve`), { params: Promise.resolve({ id: pj.data.run.id }) });
    expect(res.status).toBe(403);
    const j = await res.json();
    expect(j.error.code).toBe('SELF_APPROVAL');
  });

  it('another user can approve; run then generates invoices with line items', async () => {
    currentTenant = tenantA;
    currentUserId = USER_ID;
    const preview = await previewRun({ period: 'Terminé', feeStructureVersionId: versionA, studentIds: [s1, s2], dueDate: '2026-10-01' });
    const pj = await preview.json();
    const runId = pj.data.run.id;

    currentUserId = OTHER_ID;
    const approveRes = await Approve(putReq(`http://localhost/api/finance/fee-allocations/${runId}/approve`), { params: Promise.resolve({ id: runId }) });
    expect(approveRes.status).toBe(200);
    const aj = await approveRes.json();
    expect(aj.data.status).toBe('approved');

    const runRes = await Run(postReq(`http://localhost/api/finance/fee-allocations/${runId}/run`), { params: Promise.resolve({ id: runId }) });
    expect(runRes.status).toBe(200);
    const rj = await runRes.json();
    expect(rj.data.included).toBe(2);
    expect(rj.data.errors).toBe(0);

    const invs = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenantA), inArray(invoices.studentId, [s1, s2])));
    expect(invs).toHaveLength(2);
    for (const inv of invs) {
      expect(inv.invoiceNumber).toMatch(/^INV-2026-/);
      expect(inv.amount).toBe(2000);
      expect(inv.discountAmount).toBe(0);
      expect(inv.dueDate).toBe('2026-10-16');
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
      expect(items.map(i => i.amount).sort((a, b) => a - b)).toEqual([500, 1500]);
      const evs = await db.select().from(invoiceEvents).where(eq(invoiceEvents.invoiceId, inv.id));
      expect(evs).toHaveLength(1);
      expect((evs[0]!.payload as { source: string }).source).toBe('allocation');
    }

    const targets = await db.select().from(feeAllocationTargets).where(eq(feeAllocationTargets.runId, runId));
    expect(targets.every(t => t.status === 'included' && t.invoiceId !== null)).toBe(true);

    // Idempotency: re-running a completed run is rejected, no duplicate invoices.
    const rerun = await Run(postReq(`http://localhost/api/finance/fee-allocations/${runId}/run`), { params: Promise.resolve({ id: runId }) });
    expect(rerun.status).toBe(409);
    const count = await db.select({ n: sql<number>`count(*)` }).from(invoices).where(and(eq(invoices.tenantId, tenantA), inArray(invoices.studentId, [s1, s2])));
    expect(Number(count[0]!.n)).toBe(2);
  });

  it('a preview can be run directly without approval (optional step)', async () => {
    currentTenant = tenantA;
    currentUserId = USER_ID;
    const preview = await previewRun({ period: 'Direct', feeStructureVersionId: versionA, studentIds: [s1] });
    const pj = await preview.json();
    const runId = pj.data.run.id;
    const res = await Run(postReq(`http://localhost/api/finance/fee-allocations/${runId}/run`), { params: Promise.resolve({ id: runId }) });
    expect(res.status).toBe(200);
    expect((await res.json()).data.included).toBe(1);
  });

  it('cancel voids a previewed run and blocks later runs', async () => {
    currentTenant = tenantA;
    currentUserId = USER_ID;
    const preview = await previewRun({ period: 'Annulé', feeStructureVersionId: versionA, studentIds: [s1] });
    const pj = await preview.json();
    const runId = pj.data.run.id;
    const cancelRes = await Cancel(putReq(`http://localhost/api/finance/fee-allocations/${runId}/cancel`), { params: Promise.resolve({ id: runId }) });
    expect(cancelRes.status).toBe(200);
    expect((await cancelRes.json()).data.status).toBe('cancelled');
    const runRes = await Run(postReq(`http://localhost/api/finance/fee-allocations/${runId}/run`), { params: Promise.resolve({ id: runId }) });
    expect(runRes.status).toBe(409);
  });

  it('does not leak another tenant\'s run', async () => {
    currentTenant = tenantA;
    currentUserId = USER_ID;
    const preview = await previewRun({ period: 'Iso', feeStructureVersionId: versionA, studentIds: [s1] });
    const pj = await preview.json();
    const runId = pj.data.run.id;

    currentTenant = tenantB;
    const detail = await GetDetail(new Request('http://localhost/api/finance/fee-allocations/x'), { params: Promise.resolve({ id: runId }) });
    expect(detail.status).toBe(404);
    const run = await Run(postReq(`http://localhost/api/finance/fee-allocations/x/run`), { params: Promise.resolve({ id: runId }) });
    expect(run.status).toBe(404);
  });
});
