import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { tryPostPaymentGLEntry } from '@/libs/finance/gl-auto-post';
import { accountingAdapterExceptions, chartOfAccounts, fiscalPeriods, invoices, journalEntries, journalEntryLines, paymentReversals, payments, refunds, tenants, user } from '@/models/Schema';
import { POST as createPayment } from '@/app/api/finance/payments/route';
import { GET as getPostingStatus, POST as retryPosting } from '@/app/api/finance/accounting/posting-status/route';

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
    // A school that keeps a ledger but has no open fiscal period: the S-3 case.
    await db.insert(chartOfAccounts).values([
      { tenantId, code: '512', name: 'Bank', accountType: 'asset' },
      { tenantId, code: '411', name: 'Receivables', accountType: 'asset' },
      { tenantId, code: '516', name: 'Cash', accountType: 'asset' },
    ]);
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

    const blockedRetry = await retryPosting(new Request('http://localhost/api/finance/accounting/posting-status', { method: 'POST' }));
    expect(blockedRetry.status).toBe(409);

    await db.insert(fiscalPeriods).values({ tenantId, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', status: 'open' });

    const retry = await retryPosting(new Request('http://localhost/api/finance/accounting/posting-status', { method: 'POST' }));
    expect(retry.status).toBe(200);
    expect((await retry.json()).data).toMatchObject({ attempted: 1, posted: 1, blocked: 0 });
    const repeat = await retryPosting(new Request('http://localhost/api/finance/accounting/posting-status', { method: 'POST' }));
    expect((await repeat.json()).data).toMatchObject({ attempted: 0, posted: 0 });
    await Promise.all(Array.from({ length: 2 }, () => tryPostPaymentGLEntry({ tenantId, actorId,
      paymentId: body.data.payment.id, invoiceNumber: 'GL-TEST-1', amount: '120.00',
      paymentDate: body.data.payment.paymentDate })));
    const entries = await db.select().from(journalEntries).where(and(
      eq(journalEntries.tenantId, tenantId), eq(journalEntries.sourceModule, 'payment'), eq(journalEntries.sourceId, body.data.payment.id),
    ));
    expect(entries).toHaveLength(1);
    const paymentLines = await db.select({ code: chartOfAccounts.code, debit: journalEntryLines.debitAmount,
      credit: journalEntryLines.creditAmount }).from(journalEntryLines)
      .innerJoin(chartOfAccounts, and(eq(chartOfAccounts.id, journalEntryLines.accountId), eq(chartOfAccounts.tenantId, tenantId)))
      .where(and(eq(journalEntryLines.tenantId, tenantId), eq(journalEntryLines.journalEntryId, entries[0]!.id)));
    expect(paymentLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: '512', debit: '120.00' }),
      expect.objectContaining({ code: '411', credit: '120.00' }),
    ]));
    const [resolved] = await db.select().from(accountingAdapterExceptions).where(and(
      eq(accountingAdapterExceptions.tenantId, tenantId), eq(accountingAdapterExceptions.sourceDocumentId, body.data.payment.id),
    ));
    expect(resolved?.status).toBe('resolved');
    const finalStatus = await getPostingStatus(new Request('http://localhost/api/finance/accounting/posting-status'));
    expect((await finalStatus.json()).data).toMatchObject({ unpostedPaymentsCount: 0, unpostedPaymentsAmount: 0 });

    const now = new Date().toISOString();
    const [reversal] = await db.insert(paymentReversals).values({ tenantId, paymentId: body.data.payment.id,
      status: 'approved', reversedAt: now, reversedById: actorId, approvedById: actorId }).returning({ id: paymentReversals.id });
    await db.update(payments).set({ status: 'reversed' }).where(and(eq(payments.tenantId, tenantId), eq(payments.id, body.data.payment.id)));
    const [secondInvoice] = await db.insert(invoices).values({ tenantId, studentId, invoiceNumber: 'GL-TEST-2',
      amount: 50, netAmount: 50, paidAmount: 0, status: 'pending', dueDate: '2026-12-31' }).returning({ id: invoices.id });
    const secondPaymentResponse = await createPayment(new Request('http://localhost/api/finance/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: secondInvoice!.id, amount: '50.00', paymentMethod: 'card', idempotencyKey: randomUUID() }),
    }));
    expect(secondPaymentResponse.status).toBe(200);
    const secondPayment = (await secondPaymentResponse.json()).data.payment;
    const [refund] = await db.insert(refunds).values({ tenantId, studentId, paymentId: secondPayment.id,
      refundNumber: `RF-${tenantId.slice(0, 8)}`, amount: '20.00', reason: 'Test refund',
      status: 'approved', decidedAt: now }).returning({ id: refunds.id });

    const adjustmentStatus = await getPostingStatus(new Request('http://localhost/api/finance/accounting/posting-status'));
    expect((await adjustmentStatus.json()).data).toMatchObject({ unpostedPaymentsCount: 0,
      unpostedAdjustmentsCount: 2, unpostedAdjustmentsAmount: 140 });
    const adjustmentRetry = await retryPosting(new Request('http://localhost/api/finance/accounting/posting-status', { method: 'POST' }));
    expect((await adjustmentRetry.json()).data).toMatchObject({ attempted: 2, posted: 2, blocked: 0 });
    const adjustmentEntries = await db.select().from(journalEntries).where(and(eq(journalEntries.tenantId, tenantId),
      inArray(journalEntries.sourceId, [reversal!.id, refund!.id])));
    expect(adjustmentEntries).toHaveLength(2);
    const [refundEntry] = adjustmentEntries.filter(entry => entry.sourceId === refund!.id);
    const refundLines = await db.select({ code: chartOfAccounts.code, credit: journalEntryLines.creditAmount })
      .from(journalEntryLines).innerJoin(chartOfAccounts,
        and(eq(chartOfAccounts.id, journalEntryLines.accountId), eq(chartOfAccounts.tenantId, tenantId)))
      .where(and(eq(journalEntryLines.tenantId, tenantId), eq(journalEntryLines.journalEntryId, refundEntry!.id)));
    expect(refundLines).toContainEqual(expect.objectContaining({ code: '516', credit: '20.00' }));
    const cleanStatus = await getPostingStatus(new Request('http://localhost/api/finance/accounting/posting-status'));
    expect((await cleanStatus.json()).data).toMatchObject({ unpostedAdjustmentsCount: 0 });
  });
});

describe.skipIf(!available)('payment posting for a school without a ledger', () => {
  const tenantId = randomUUID();
  const actorId = `GL-NOLEDGER-ACTOR-${tenantId}`;
  const studentId = `GL-NOLEDGER-STUDENT-${tenantId}`;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'GL No Ledger Test', slug: `gl-noledger-${tenantId}` });
    await db.insert(user).values([
      { id: actorId, tenantId, name: 'Actor', email: `${actorId}@example.test`, role: 'school_admin' },
      { id: studentId, tenantId, name: 'Student', email: `${studentId}@example.test`, role: 'student' },
    ]);
  });

  afterAll(async () => {
    await db.delete(accountingAdapterExceptions).where(eq(accountingAdapterExceptions.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('raises no exception without a chart of accounts, yet still counts the payment as unposted', async () => {
    authState.tenantId = tenantId;
    authState.userId = actorId;
    const [invoice] = await db.insert(invoices).values({ tenantId, studentId, invoiceNumber: 'GL-NL-1', amount: 80, netAmount: 80, paidAmount: 0, status: 'pending', dueDate: '2026-12-31' }).returning({ id: invoices.id });
    const response = await createPayment(new Request('http://localhost/api/finance/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: invoice!.id, amount: '80.00', paymentMethod: 'card', idempotencyKey: randomUUID() }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, glPosted: false });
    const exceptions = await db.select().from(accountingAdapterExceptions).where(eq(accountingAdapterExceptions.tenantId, tenantId));
    expect(exceptions).toHaveLength(0);
    const status = await getPostingStatus(new Request('http://localhost/api/finance/accounting/posting-status'));
    expect((await status.json()).data).toMatchObject({ unpostedPaymentsCount: 1, unpostedPaymentsAmount: 80 });
  });
});
