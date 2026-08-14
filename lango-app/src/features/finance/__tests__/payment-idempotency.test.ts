import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/finance/payments/route';
import { db } from '@/libs/DB';
import { invoiceEvents, invoices, payments, tenants, user } from '@/models/Schema';
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
const USER_ID = `USR-PAY-${crypto.randomUUID()}`;

describe.skipIf(!hasDb)('payment idempotency (Phase A)', () => {
  const tenantId = crypto.randomUUID();
  const studentId = `USR-STU-${crypto.randomUUID()}`;
  let invoiceId = '';

  function fakeContext(): RequestContext {
    return {
      userId: USER_ID,
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
    await db.insert(tenants).values({ id: tenantId, name: 'Payment Test', slug: `payment-${tenantId}` });
    await db.insert(user).values({ id: USER_ID, tenantId, name: 'Payment Tester', email: `paymentadmin-${tenantId}@test.local`, role: 'school_admin' });
    await db.insert(user).values({ id: studentId, tenantId, name: 'Test Student', email: `student-${tenantId}@test.local`, role: 'student' });
    const [inv] = await db.insert(invoices).values({
      tenantId,
      studentId,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: 500,
      discountAmount: 0,
      netAmount: 500,
      paidAmount: 0,
      status: 'pending',
      dueDate: '2026-12-31',
    }).returning();
    invoiceId = inv!.id;
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

  it('double-post with the same idempotencyKey creates exactly one payment and one event', async () => {
    const key = `idem-${crypto.randomUUID()}`;

    const first = await postPayment({ invoiceId, amount: '500.00', paymentMethod: 'card', idempotencyKey: key });
    expect(first.status).toBe(200);
    const j1 = await first.json();
    expect(j1.success).toBe(true);
    expect(j1.idempotent).toBeUndefined();

    const second = await postPayment({ invoiceId, amount: '500.00', paymentMethod: 'card', idempotencyKey: key });
    expect(second.status).toBe(200);
    const j2 = await second.json();
    expect(j2.success).toBe(true);
    expect(j2.idempotent).toBe(true);

    const rows = await db.select().from(payments)
      .where(and(eq(payments.invoiceId, invoiceId), eq(payments.tenantId, tenantId)));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.idempotencyKey).toBe(key);

    const events = await db.select().from(invoiceEvents).where(eq(invoiceEvents.invoiceId, invoiceId));
    expect(events.filter(e => e.eventType === 'payment_recorded')).toHaveLength(1);
  });
});
