import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/finance/payments/route';
import { db } from '@/libs/DB';
import { invoiceEvents, invoices, paymentAllocations, payments, tenants, user } from '@/models/Schema';
import { receipts } from '@/features/finance/models/student-accounting-schema';
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
const RECEIPT_PREFIX = `RC-${new Date().getFullYear()}-`;

function createInvoiceRow(tenantId: string, studentId: string, netAmount: number, status: 'draft' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'credited' = 'pending') {
  return {
    tenantId,
    studentId,
    invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    amount: netAmount,
    discountAmount: 0,
    netAmount,
    paidAmount: 0,
    status,
    dueDate: '2026-12-31',
  };
}

describe.skipIf(!hasDb)('payment allocations (Phase D)', () => {
  const tenantId = crypto.randomUUID();
  const studentA = `USR-STUA-${crypto.randomUUID()}`;
  const studentB = `USR-STUB-${crypto.randomUUID()}`;
  let invoiceA1 = '';
  let invoiceA2 = '';
  let invoiceB1 = '';

  function fakeContext(): RequestContext {
    return {
      userId: ADMIN_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Payment Tester',
      email: 'payment.tester@example.com',
    };
  }

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue(fakeContext());
    await db.insert(tenants).values({ id: tenantId, name: 'Allocation Test', slug: `allocation-${tenantId}` });
    await db.insert(user).values({ id: ADMIN_ID, tenantId, name: 'Allocation Admin', email: `adm-${tenantId}@test.local`, role: 'school_admin' });
    await db.insert(user).values([
      { id: studentA, tenantId, name: 'Student A', email: `a-${tenantId}@test.local`, role: 'student' },
      { id: studentB, tenantId, name: 'Student B', email: `b-${tenantId}@test.local`, role: 'student' },
    ]);

    const [a1] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentA, 300)).returning();
    const [a2] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentA, 100)).returning();
    const [b1] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentB, 500)).returning();
    invoiceA1 = a1!.id;
    invoiceA2 = a2!.id;
    invoiceB1 = b1!.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  function postPayment(body: unknown) {
    return POST(new Request('http://localhost/api/finance/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  it('splits one payment across two invoices with allocations, receipt and events', async () => {
    const res = await postPayment({
      allocations: [
        { invoiceId: invoiceA1, amount: '200.00' },
        { invoiceId: invoiceA2, amount: '100.00' },
      ],
      paymentMethod: 'card',
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.receipt.receiptNumber).toMatch(new RegExp(`^${RECEIPT_PREFIX}`));

    // Payment is anchored on the first allocation's invoice (single NOT NULL FK).
    const [payment] = await db.select().from(payments).where(eq(payments.id, json.data.payment.id));
    expect(payment!.invoiceId).toBe(invoiceA1);
    expect(payment!.studentId).toBe(studentA);
    expect(Number(payment!.amount)).toBe(300);

    // Two allocation rows carrying the per-invoice split.
    const allocs = await db.select().from(paymentAllocations).where(eq(paymentAllocations.paymentId, payment!.id));
    expect(allocs).toHaveLength(2);
    const allocByInvoice = new Map(allocs.map(a => [a.invoiceId, Number(a.allocatedAmount)]));
    expect(allocByInvoice.get(invoiceA1)).toBe(200);
    expect(allocByInvoice.get(invoiceA2)).toBe(100);

    // Invoices moved to partial / paid.
    const [ia1] = await db.select().from(invoices).where(eq(invoices.id, invoiceA1));
    const [ia2] = await db.select().from(invoices).where(eq(invoices.id, invoiceA2));
    expect(ia1!.status).toBe('partial');
    expect(Number(ia1!.paidAmount)).toBe(200);
    expect(ia2!.status).toBe('paid');
    expect(Number(ia2!.paidAmount)).toBe(100);

    // Persisted receipt with the allocations breakdown.
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, json.data.receipt.id));
    expect(receipt!.receiptNumber).toMatch(new RegExp(`^${RECEIPT_PREFIX}`));
    expect(Number(receipt!.amount)).toBe(300);
    expect(receipt!.studentId).toBe(studentA);
    const allocationsJson = receipt!.allocations as unknown as { invoiceNumber: string; amount: string }[];
    expect(allocationsJson).toHaveLength(2);

    // One payment_recorded event per touched invoice.
    const events = await db.select().from(invoiceEvents)
      .where(and(eq(invoiceEvents.invoiceId, invoiceA1), eq(invoiceEvents.eventType, 'payment_recorded')));
    expect(events).toHaveLength(1);
    expect(typeof (events[0]!.payload as Record<string, unknown>).invoiceNumber).toBe('string');
  });

  it('rejects overpay that exceeds the total outstanding balance', async () => {
    const [fresh] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentA, 50)).returning();
    const res = await postPayment({ allocations: [{ invoiceId: fresh!.id, amount: '500.00' }], paymentMethod: 'cash' });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
  });

  it('rejects a per-invoice allocation that exceeds its own balance even when the total is in range', async () => {
    const [ia] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentA, 100)).returning();
    const [ib] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentA, 100)).returning();
    // Total 200 == outstanding 200 (total passes) but 150 > 100 (per-invoice fails).
    const res = await postPayment({
      allocations: [
        { invoiceId: ia!.id, amount: '150.00' },
        { invoiceId: ib!.id, amount: '50.00' },
      ],
      paymentMethod: 'cash',
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
  });

  it('idempotent replay returns the original payment without a new receipt', async () => {
    const [fresh] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentA, 90)).returning();
    const key = `idem-alloc-${crypto.randomUUID()}`;
    const body = { allocations: [{ invoiceId: fresh!.id, amount: '90.00' }], paymentMethod: 'transfer', idempotencyKey: key };

    const first = await postPayment(body);
    expect(first.status).toBe(200);
    const j1 = await first.json();
    expect(j1.idempotent).toBeUndefined();
    const receiptCountBefore = (await db.select().from(receipts).where(eq(receipts.tenantId, tenantId))).length;

    const second = await postPayment(body);
    expect(second.status).toBe(200);
    const j2 = await second.json();
    expect(j2.idempotent).toBe(true);
    expect(j2.data.payment.id).toBe(j1.data.payment.id);
    expect(j2.data.receipt).toBeNull();

    const receiptsNow = await db.select().from(receipts).where(eq(receipts.tenantId, tenantId));
    expect(receiptsNow).toHaveLength(receiptCountBefore);
  });

  it('rejects allocations that reference an invoice outside the tenant', async () => {
    const otherTenant = crypto.randomUUID();
    const foreignStudent = `USR-X-${crypto.randomUUID()}`;
    await db.insert(tenants).values({ id: otherTenant, name: 'Other Tenant', slug: `other-${otherTenant}` });
    await db.insert(user).values({ id: foreignStudent, tenantId: otherTenant, name: 'X', email: `x-${otherTenant}@test.local`, role: 'student' });
    const [foreign] = await db.insert(invoices).values(createInvoiceRow(otherTenant, foreignStudent, 100)).returning();

    const res = await postPayment({ allocations: [{ invoiceId: foreign!.id, amount: '100.00' }], paymentMethod: 'cash' });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_REFERENCE');
    await db.delete(tenants).where(eq(tenants.id, otherTenant));
  });

  it('still accepts the legacy single-invoice body shape', async () => {
    const [fresh] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentB, 60)).returning();
    const res = await postPayment({ invoiceId: fresh!.id, amount: '60.00', paymentMethod: 'check' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.payment.invoiceId).toBe(fresh!.id);
  });

  it('rejects allocations mixing two different students', async () => {
    const res = await postPayment({
      allocations: [
        { invoiceId: invoiceA1, amount: '1.00' },
        { invoiceId: invoiceB1, amount: '1.00' },
      ],
      paymentMethod: 'cash',
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe('PAYMENT_MIXED_STUDENTS');
  });
});
