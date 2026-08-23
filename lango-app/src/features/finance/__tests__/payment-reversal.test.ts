import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as postPayment } from '@/app/api/finance/payments/route';
import { POST as reversePayment } from '@/app/api/finance/payments/[id]/reverse/route';
import { decidePaymentReversal } from '@/libs/services/payment-reversal';
import { db } from '@/libs/DB';
import { invoiceEvents, invoices, payments, tenants, user } from '@/models/Schema';
import { paymentReversals } from '@/features/finance/models/student-accounting-schema';
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

describe.skipIf(!hasDb)('payment reversal (Phase E)', () => {
  const tenantId = crypto.randomUUID();
  const studentId = `USR-STU-${crypto.randomUUID()}`;

  function fakeContext(): RequestContext {
    return {
      userId: ADMIN_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Reversal Tester',
      email: 'reversal.tester@example.com',
    };
  }

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue(fakeContext());
    await db.insert(tenants).values({ id: tenantId, name: 'Reversal Test', slug: `reversal-${tenantId}` });
    await db.insert(user).values({ id: ADMIN_ID, tenantId, name: 'Reversal Admin', email: `adm-${tenantId}@test.local`, role: 'school_admin' });
    await db.insert(user).values({ id: studentId, tenantId, name: 'Reversal Student', email: `stu-${tenantId}@test.local`, role: 'student' });
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

  function reverse(id: string, reason: string) {
    return reversePayment(new Request('http://localhost/api/finance/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }), { params: Promise.resolve({ id }) });
  }

  it('reverses a posted multi-invoice payment, restoring each invoice and marking the payment reversed', async () => {
    const [a1] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentId, 200)).returning();
    const [a2] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentId, 100)).returning();

    const payRes = await pay({
      allocations: [
        { invoiceId: a1!.id, amount: '200.00' },
        { invoiceId: a2!.id, amount: '100.00' },
      ],
      paymentMethod: 'card',
    });
    expect(payRes.status).toBe(200);
    const paymentId = (await payRes.json()).data.payment.id;

    const revRes = await reverse(paymentId, 'Erreur de saisie');
    expect(revRes.status).toBe(201);
    expect((await revRes.json()).success).toBe(true);

    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
    expect(payment!.status).toBe('reversed');

    const [ia1] = await db.select().from(invoices).where(eq(invoices.id, a1!.id));
    const [ia2] = await db.select().from(invoices).where(eq(invoices.id, a2!.id));
    expect(Number(ia1!.paidAmount)).toBe(0);
    expect(ia1!.status).toBe('pending');
    expect(Number(ia2!.paidAmount)).toBe(0);
    expect(ia2!.status).toBe('pending');

    const reversals = await db.select().from(paymentReversals).where(eq(paymentReversals.paymentId, paymentId));
    expect(reversals).toHaveLength(1);
    expect(reversals[0]!.status).toBe('approved');

    const events = await db.select().from(invoiceEvents)
      .where(and(eq(invoiceEvents.invoiceId, a1!.id), eq(invoiceEvents.eventType, 'payment_reversed')));
    expect(events).toHaveLength(1);
  });

  it('rejects reversing an already-reversed payment', async () => {
    const [inv] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentId, 50)).returning();
    const payRes = await pay({ allocations: [{ invoiceId: inv!.id, amount: '50.00' }], paymentMethod: 'card' });
    const paymentId = (await payRes.json()).data.payment.id;
    await reverse(paymentId, 'première fois');

    const again = await reverse(paymentId, 'deuxième fois');
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe('PAYMENT_NOT_REVERSIBLE');
  });

  it('rejects a reversal decision without a reason', async () => {
    const [inv] = await db.insert(invoices).values(createInvoiceRow(tenantId, studentId, 50)).returning();
    const payRes = await pay({ allocations: [{ invoiceId: inv!.id, amount: '50.00' }], paymentMethod: 'card' });
    const paymentId = (await payRes.json()).data.payment.id;

    const [draft] = await db.insert(paymentReversals).values({
      tenantId,
      paymentId,
      reason: 'test',
      status: 'draft',
      reversedById: ADMIN_ID,
    }).returning();

    await expect(
      decidePaymentReversal({ tenantId, id: draft!.id, decision: 'rejected', decidedById: ADMIN_ID }),
    ).rejects.toMatchObject({ status: 422, code: 'REASON_REQUIRED' });
  });
});
