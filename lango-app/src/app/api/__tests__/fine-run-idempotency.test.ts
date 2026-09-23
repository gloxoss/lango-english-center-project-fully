import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/finance/fine-runs/route';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { fineAssessments, finePolicies, invoiceEvents, invoices, tenants, user } from '@/models/Schema';

const auth = vi.hoisted(() => ({ tenantId: '' }));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async () => ({ tenantId: auth.tenantId, userId: null, role: 'school_admin', branchId: null }),
  requireTenant: (context: { tenantId: string }) => context.tenantId,
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: async () => undefined }));
vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const available = await db.execute(sql`SELECT 1`).then(() => true, () => false);

describe.skipIf(!available)('fine runs', () => {
  const tenantId = randomUUID();
  const studentId = `FINE-STUDENT-${tenantId}`;
  let invoiceId: string;
  let policyId: string;

  async function run() {
    return POST(new Request('http://localhost/api/finance/fine-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finePolicyId: policyId }),
    }));
  }

  beforeAll(async () => {
    auth.tenantId = tenantId;
    const today = casablancaTodayIso();
    const due = new Date(`${today}T12:00:00Z`);
    due.setUTCDate(due.getUTCDate() - 10);
    await db.insert(tenants).values({ id: tenantId, name: 'Fine Run Test', slug: `fine-${tenantId}` });
    await db.insert(user).values({ id: studentId, tenantId, name: 'Fine Student', email: `${studentId}@example.test`, role: 'student' });
    const [invoice] = await db.insert(invoices).values({
      tenantId, studentId, invoiceNumber: `TEST-${tenantId}`, amount: 1000,
      netAmount: 1000, paidAmount: 0, status: 'pending', dueDate: due.toISOString().slice(0, 10),
    }).returning({ id: invoices.id });
    invoiceId = invoice!.id;
    const [policy] = await db.insert(finePolicies).values({
      tenantId, name: 'Flat once', formula: 'flat', flatAmount: 25, graceDays: 2,
    }).returning({ id: finePolicies.id });
    policyId = policy!.id;
  });

  afterAll(async () => {
    await db.delete(invoiceEvents).where(eq(invoiceEvents.tenantId, tenantId));
    await db.delete(fineAssessments).where(eq(fineAssessments.tenantId, tenantId));
    await db.delete(finePolicies).where(eq(finePolicies.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('creates one assessment and matching event across concurrent retries', async () => {
    const responses = await Promise.all([run(), run()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const counts = await Promise.all(responses.map(async (response) => (await response.json()).data.assessed));
    expect(counts.sort()).toEqual([0, 1]);
    const rows = await db.select().from(fineAssessments).where(and(
      eq(fineAssessments.tenantId, tenantId), eq(fineAssessments.invoiceId, invoiceId),
    ));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(25);
    const events = await db.select().from(invoiceEvents).where(and(
      eq(invoiceEvents.tenantId, tenantId), eq(invoiceEvents.invoiceId, invoiceId),
    ));
    expect(events).toHaveLength(1);
  });
});
