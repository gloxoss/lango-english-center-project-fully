import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/finance/fine-runs/route';
import { POST as waiveFine } from '@/app/api/finance/fine-assessments/route';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { fineAssessments, finePolicies, invoiceEvents, invoiceItems, invoices, tenants, user } from '@/models/Schema';

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
    await db.delete(invoiceItems).where(eq(invoiceItems.tenantId, tenantId));
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

  it('puts the fine on the family balance exactly once', async () => {
    // The assessment alone used to be the whole story: nothing that computes
    // what a family owes read fine_assessments, so the fine never reached the
    // balance. Repeated and overlapping runs must not raise it twice either.
    await Promise.all([run(), run()]);
    await run();

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    expect(invoice!.amount).toBe(1025);
    // Balance is net minus paid: the 1000 invoiced plus one 25 fine.
    expect(invoice!.netAmount - invoice!.paidAmount).toBe(1025);

    const lines = await db.select().from(invoiceItems).where(and(
      eq(invoiceItems.tenantId, tenantId),
      eq(invoiceItems.invoiceId, invoiceId),
    ));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.amount).toBe(25);
    expect(lines[0]!.fineAssessmentId).toBeTruthy();
  });

  it('removes a waived fine from the family balance once, while retaining its invoice line', async () => {
    const [assessment] = await db.select().from(fineAssessments).where(and(
      eq(fineAssessments.tenantId, tenantId), eq(fineAssessments.invoiceId, invoiceId),
    ));
    const waive = () => waiveFine(new Request('http://localhost/api/finance/fine-assessments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: assessment!.id, waiveReason: 'Approved school waiver' }),
    }));
    expect((await waive()).status).toBe(200);
    expect((await waive()).status).toBe(200);
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)));
    expect(invoice).toMatchObject({ amount: 1025, discountAmount: 25, netAmount: 1000 });
    const [waived] = await db.select().from(fineAssessments).where(and(eq(fineAssessments.tenantId, tenantId), eq(fineAssessments.id, assessment!.id)));
    expect(waived).toMatchObject({ status: 'waived', waivedAmount: 25 });
    const lines = await db.select().from(invoiceItems).where(and(eq(invoiceItems.tenantId, tenantId), eq(invoiceItems.invoiceId, invoiceId)));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ amount: 25, fineAssessmentId: assessment!.id });
    const events = await db.select().from(invoiceEvents).where(and(eq(invoiceEvents.tenantId, tenantId), eq(invoiceEvents.invoiceId, invoiceId)));
    expect(events.filter(event => event.eventType === 'fine_waived')).toHaveLength(1);
  });
});
