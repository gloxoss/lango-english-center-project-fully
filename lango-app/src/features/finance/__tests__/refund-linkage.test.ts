import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as postPayment } from '@/app/api/finance/payments/route';
import { POST as postRefund } from '@/app/api/finance/refunds/route';
import { db } from '@/libs/DB';
import { invoiceEvents, invoices, payments, tenants, user } from '@/models/Schema';
import { studentCredits } from '@/features/finance/models/student-accounting-schema';
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

function createInvoiceRow(tenantId: string, studentId: string, netAmount: number) {
  return {
    tenantId,
    studentId,
    invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    amount: netAmount,
    discountAmount: 0,
    netAmount,
    paidAmount: 0,
    status: 'pending' as const,
    dueDate: '2026-12-31',
  };
}

describe.skipIf(!hasDb)('refund linkage (Phase E)', () => {
  const tenantId = crypto.randomUUID();
  const studentId = `USR-STU-${crypto.randomUUID()}`;

  function fakeContext(): RequestContext {
    return {
      userId: ADMIN_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Refund Tester',
      email: 'refund.tester@example.com',
    };
  }

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue(fakeContext());
    await db.insert(tenants).values({ id: tenantId, name: 'Refund Test', slug: `refund-${tenantId}` });
    await db.insert(user).values({ id: ADMIN_ID, tenantId, name: 'Refund Admin', email: `adm-${tenantId}@test.local`, role: 'school_admin' });
    await db.insert(user).values({ id: studentId, tenantId, name: 'Refund Student', email: `stu-${tenantId}@test.local`, role: 'student' });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  function pay(body: unknown) {
    return postPayment(new Request('http://localhost/api/finance/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  function refund(body: unknown) {
    return postRefund(new NextRequest('http://localhost/api/finance/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  it('approving a refund marks the payment refunded and reduces the invoice paidAmount', async () => {
    const [inv] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentId, 100)).returning();
    const payRes = await pay({ allocations: [{ invoiceId: inv!.id, amount: '100.00' }], paymentMethod: 'card' });
    const paymentId = (await payRes.json()).data.payment.id;

    const refundRes = await refund({
      studentId,
      paymentId,
      amount: '60.00',
      refundMethod: 'cash',
      reason: 'Trop payé',
    });
    expect(refundRes.status).toBe(201);
    expect((await refundRes.json()).success).toBe(true);

    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
    expect(payment!.status).toBe('refunded');

    const [inv2] = await db.select().from(invoices).where(eq(invoices.id, inv!.id));
    expect(Number(inv2!.paidAmount)).toBe(40);
    expect(inv2!.status).toBe('partial');

    const events = await db.select().from(invoiceEvents)
      .where(and(eq(invoiceEvents.invoiceId, inv!.id), eq(invoiceEvents.eventType, 'refund_recorded')));
    expect(events).toHaveLength(1);
  });

  it('fully refunding a payment reduces the invoice to pending and creates no stray credit', async () => {
    const [inv] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentId, 100)).returning();
    const payRes = await pay({ allocations: [{ invoiceId: inv!.id, amount: '100.00' }], paymentMethod: 'card' });
    const paymentId = (await payRes.json()).data.payment.id;

    const refundRes = await refund({
      studentId,
      paymentId,
      amount: '100.00',
      refundMethod: 'cash',
      reason: 'Remboursement total',
    });
    expect(refundRes.status).toBe(201);

    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
    expect(payment!.status).toBe('refunded');

    const [inv2] = await db.select().from(invoices).where(eq(invoices.id, inv!.id));
    expect(Number(inv2!.paidAmount)).toBe(0);
    expect(inv2!.status).toBe('pending');

    const credits = await db.select().from(studentCredits)
      .where(and(eq(studentCredits.tenantId, tenantId), eq(studentCredits.studentId, studentId), eq(studentCredits.source, 'refund')));
    expect(credits).toHaveLength(0);
  });
});
