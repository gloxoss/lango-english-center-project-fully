import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { createPayment } from '@/libs/services/payment-create';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { invoices, paymentAllocations, payments, tenants, user } from '@/models/Schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('financial correctness & arithmetic assertions (T13)', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const adminId = `FIN-ADMIN-${suffix}`;
  const studentId = `FIN-STUDENT-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: `Finance School ${suffix}`, slug: `fin-${suffix}` },
    ]);
    await db.insert(user).values([
      { id: adminId, tenantId, name: 'Finance Admin', email: `admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentId, tenantId, name: 'Student Client', email: `stu-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);
  });

  afterAll(async () => {
    await db.delete(paymentAllocations).where(eq(paymentAllocations.tenantId, tenantId));
    await db.delete(payments).where(eq(payments.tenantId, tenantId));
    await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('handles partial payments and transitions status from pending to partial to paid', async () => {
    const invId = crypto.randomUUID();
    await db.insert(invoices).values({
      id: invId,
      tenantId,
      studentId,
      invoiceNumber: `INV-PARTIAL-${suffix}`,
      amount: 1000,
      discountAmount: 0,
      netAmount: 1000,
      paidAmount: 0,
      status: 'pending',
      dueDate: '2026-10-01',
    });

    // 1. First partial payment: 300 MAD
    const res1 = await createPayment({
      tenantId,
      actorId: adminId,
      receivedById: adminId,
      paymentMethod: 'cash',
      allocations: [{ invoiceId: invId, amount: '300.00' }],
    });

    expect(res1.idempotent).toBe(false);
    expect(res1.totalPaymentCents).toBe(BigInt(30000));

    const [invAfter1] = await db.select().from(invoices).where(eq(invoices.id, invId));
    expect(Number(invAfter1!.paidAmount)).toBe(300);
    expect(invAfter1!.status).toBe('partial');

    // 2. Second partial payment: 700 MAD (exact remainder)
    const res2 = await createPayment({
      tenantId,
      actorId: adminId,
      receivedById: adminId,
      paymentMethod: 'cash',
      allocations: [{ invoiceId: invId, amount: '700.00' }],
    });

    expect(res2.idempotent).toBe(false);
    const [invAfter2] = await db.select().from(invoices).where(eq(invoices.id, invId));
    expect(Number(invAfter2!.paidAmount)).toBe(1000);
    expect(invAfter2!.status).toBe('paid');
  });

  it('handles multiple decimal partial payments without IEEE-754 floating point drift', async () => {
    const invId = crypto.randomUUID();
    // 1500.50 MAD total
    await db.insert(invoices).values({
      id: invId,
      tenantId,
      studentId,
      invoiceNumber: `INV-DECIMAL-${suffix}`,
      amount: 1500.50,
      discountAmount: 0,
      netAmount: 1500.50,
      paidAmount: 0,
      status: 'pending',
      dueDate: '2026-10-01',
    });

    // Pay 500.25 MAD
    await createPayment({
      tenantId,
      actorId: adminId,
      receivedById: adminId,
      paymentMethod: 'card',
      allocations: [{ invoiceId: invId, amount: '500.25' }],
    });

    // Pay 500.25 MAD
    await createPayment({
      tenantId,
      actorId: adminId,
      receivedById: adminId,
      paymentMethod: 'card',
      allocations: [{ invoiceId: invId, amount: '500.25' }],
    });

    // Pay 500.00 MAD
    await createPayment({
      tenantId,
      actorId: adminId,
      receivedById: adminId,
      paymentMethod: 'card',
      allocations: [{ invoiceId: invId, amount: '500.00' }],
    });

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invId));
    expect(Number(inv!.paidAmount)).toBe(1500.50);
    expect(inv!.status).toBe('paid');
  });

  it('strictly rejects overpayment beyond remaining invoice balance', async () => {
    const invId = crypto.randomUUID();
    await db.insert(invoices).values({
      id: invId,
      tenantId,
      studentId,
      invoiceNumber: `INV-OVERPAY-${suffix}`,
      amount: 400,
      discountAmount: 0,
      netAmount: 400,
      paidAmount: 0,
      status: 'pending',
      dueDate: '2026-10-01',
    });

    // Attempt to pay 450 MAD on a 400 MAD invoice
    await expect(
      createPayment({
        tenantId,
        actorId: adminId,
        receivedById: adminId,
        paymentMethod: 'cash',
        allocations: [{ invoiceId: invId, amount: '450.00' }],
      }),
    ).rejects.toThrow(/dépasse/i);

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invId));
    expect(Number(inv!.paidAmount)).toBe(0);
    expect(inv!.status).toBe('pending');
  });

  it('guarantees idempotency on duplicate submission with the same idempotencyKey', async () => {
    const invId = crypto.randomUUID();
    const idemKey = `IDEM-${suffix}-${Date.now()}`;
    await db.insert(invoices).values({
      id: invId,
      tenantId,
      studentId,
      invoiceNumber: `INV-IDEM-${suffix}`,
      amount: 600,
      discountAmount: 0,
      netAmount: 600,
      paidAmount: 0,
      status: 'pending',
      dueDate: '2026-10-01',
    });

    // First payment
    const res1 = await createPayment({
      tenantId,
      actorId: adminId,
      receivedById: adminId,
      paymentMethod: 'transfer',
      idempotencyKey: idemKey,
      allocations: [{ invoiceId: invId, amount: '600.00' }],
    });

    expect(res1.idempotent).toBe(false);

    // Duplicate replayed payment with same key
    const res2 = await createPayment({
      tenantId,
      actorId: adminId,
      receivedById: adminId,
      paymentMethod: 'transfer',
      idempotencyKey: idemKey,
      allocations: [{ invoiceId: invId, amount: '600.00' }],
    });

    expect(res2.idempotent).toBe(true);
    expect(res2.payment.id).toBe(res1.payment.id);

    // Ensure only 1 payment was inserted in database
    const paymentRows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.idempotencyKey, idemKey)));

    expect(paymentRows).toHaveLength(1);
  });

  it('verifies cent-to-money and money-to-cents BigInt precision', () => {
    expect(moneyToCents('1250.00')).toBe(BigInt(125000));
    expect(moneyToCents('0.05')).toBe(BigInt(5));
    expect(moneyToCents('999999.99')).toBe(BigInt(99999999));

    expect(centsToMoney(BigInt(125000))).toBe('1250.00');
    expect(centsToMoney(BigInt(5))).toBe('0.05');
    expect(centsToMoney(BigInt(99999999))).toBe('999999.99');
  });
});
