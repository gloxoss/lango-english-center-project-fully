import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { accountingAdapterExceptions, invoices, tenants, user } from '@/models/Schema';
import { POST as createPayment } from '@/app/api/finance/payments/route';
import { GET as getPostingStatus } from '@/app/api/finance/accounting/posting-status/route';

const authState = vi.hoisted(() => ({ tenantId: '', userId: '' }));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async () => ({ tenantId: authState.tenantId, userId: authState.userId, role: 'school_admin', branchId: null }),
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: async () => undefined }));

const available = await db.execute(sql`select 1`).then(() => true, () => false);

describe.skipIf(!available)('payment ledger status', () => {
  const tenantId = randomUUID();
  const actorId = `GL-ACTOR-${tenantId}`;
  const studentId = `GL-STUDENT-${tenantId}`;
  let invoiceId: string;

  beforeAll(async () => {
    authState.tenantId = tenantId;
    authState.userId = actorId;
    await db.insert(tenants).values({ id: tenantId, name: 'GL Status Test', slug: `gl-status-${tenantId}` });
    await db.insert(user).values([
      { id: actorId, tenantId, name: 'Actor', email: `${actorId}@example.test`, role: 'school_admin' },
      { id: studentId, tenantId, name: 'Student', email: `${studentId}@example.test`, role: 'student' },
    ]);
    const [invoice] = await db.insert(invoices).values({ tenantId, studentId, invoiceNumber: 'GL-TEST-1', amount: 120, netAmount: 120, paidAmount: 0, status: 'pending', dueDate: '2026-12-31' }).returning({ id: invoices.id });
    invoiceId = invoice!.id;
  });

  afterAll(async () => {
    await db.delete(accountingAdapterExceptions).where(eq(accountingAdapterExceptions.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('records a visible exception when a posted payment cannot enter the ledger', async () => {
    const response = await createPayment(new Request('http://localhost/api/finance/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, amount: '120.00', paymentMethod: 'card', idempotencyKey: randomUUID() }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, glPosted: false });
    const exceptions = await db.select().from(accountingAdapterExceptions).where(and(
      eq(accountingAdapterExceptions.tenantId, tenantId), eq(accountingAdapterExceptions.sourceDocumentId, body.data.payment.id),
    ));
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]).toMatchObject({ sourceModule: 'payment', status: 'open' });

    const statusResponse = await getPostingStatus(new Request('http://localhost/api/finance/accounting/posting-status'));
    expect(statusResponse.status).toBe(200);
    expect((await statusResponse.json()).data).toMatchObject({ openFiscalPeriod: false, unpostedPaymentsCount: 1, unpostedPaymentsAmount: 120 });
  });
});
