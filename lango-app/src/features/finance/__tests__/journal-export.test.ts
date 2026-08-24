import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { buildStudentJournal } from '@/libs/finance/export/journal-extract';
import { invoices, payments, refunds, tenants, user } from '@/models/Schema';
import { paymentReversals, receipts, studentCredits } from '@/features/finance/models/student-accounting-schema';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('student journal extract (Phase H5)', () => {
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const studentA = `USR-JRN-${crypto.randomUUID()}`;

  function invNumber() {
    return `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantA, name: 'Journal A', slug: `journal-a-${tenantA}` });
    await db.insert(tenants).values({ id: tenantB, name: 'Journal B', slug: `journal-b-${tenantB}` });
    await db.insert(user).values({ id: studentA, tenantId: tenantA, name: 'Journal Student', email: `jrn-${tenantA}@test.local`, role: 'student' });

    // Invoice (debit).
    const [inv] = await db.insert(invoices).values({
      tenantId: tenantA,
      studentId: studentA,
      invoiceNumber: invNumber(),
      amount: 1000,
      discountAmount: 0,
      netAmount: 1000,
      paidAmount: 0,
      status: 'pending',
      dueDate: '2026-12-31',
      issueDate: '2026-08-01',
    }).returning();

    // Payment (credit) against the invoice.
    const [pay] = await db.insert(payments).values({
      tenantId: tenantA,
      invoiceId: inv!.id,
      studentId: studentA,
      amount: 500,
      paymentMethod: 'card',
      paymentDate: '2026-08-02T10:00:00.000Z',
      referenceId: 'REF-001',
      status: 'posted',
    }).returning();

    // Receipt (credit).
    await db.insert(receipts).values({
      tenantId: tenantA,
      receiptNumber: `RC-2026-001`,
      studentId: studentA,
      amount: 200,
      paymentDate: '2026-08-03',
      allocations: [],
    });

    // Refund (debit) — linked to a compatible original payment (DB trigger).
    await db.insert(refunds).values({
      tenantId: tenantA,
      studentId: studentA,
      paymentId: pay!.id,
      refundNumber: 'RF-2026-001',
      amount: '50.00',
      reason: 'Test refund',
      createdAt: '2026-08-04T10:00:00.000Z',
    });

    // Student credit (credit).
    await db.insert(studentCredits).values({
      tenantId: tenantA,
      studentId: studentA,
      amount: 150,
      balance: 150,
      createdAt: '2026-08-05T10:00:00.000Z',
    });

    // Reversal of a separate payment (debit).
    const [pay2] = await db.insert(payments).values({
      tenantId: tenantA,
      invoiceId: inv!.id,
      studentId: studentA,
      amount: 100,
      paymentMethod: 'cash',
      paymentDate: '2026-08-06T10:00:00.000Z',
      status: 'posted',
    }).returning();
    await db.insert(paymentReversals).values({
      tenantId: tenantA,
      paymentId: pay2!.id,
      reversedAt: '2026-08-07T10:00:00.000Z',
      status: 'approved',
    });

    // A foreign tenant invoice that must not leak.
    await db.insert(invoices).values({
      tenantId: tenantB,
      studentId: studentA,
      invoiceNumber: invNumber(),
      amount: 9999,
      discountAmount: 0,
      netAmount: 9999,
      paidAmount: 0,
      status: 'pending',
      dueDate: '2026-12-31',
      issueDate: '2026-08-01',
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  it('extracts invoice/payment/receipt/refund/credit/reversal rows with directions', async () => {
    const rows = await buildStudentJournal(tenantA, {});
    const byType = (t: string) => rows.filter(r => r.type === t);

    const inv = byType('invoice');
    expect(inv).toHaveLength(1);
    expect(inv[0]!.amount).toBe('1000.00');
    expect(inv[0]!.direction).toBe('debit');
    expect(inv[0]!.currency).toBe('MAD');

    const pay = byType('payment');
    expect(pay).toHaveLength(2);
    const pay500 = pay.find(r => r.amount === '500.00');
    expect(pay500!.direction).toBe('credit');
    expect(pay500!.reference).toBe('REF-001');

    expect(byType('receipt')[0]).toMatchObject({ amount: '200.00', direction: 'credit' });
    expect(byType('refund')[0]).toMatchObject({ amount: '50.00', direction: 'debit' });
    expect(byType('credit')[0]).toMatchObject({ amount: '150.00', direction: 'credit' });
    expect(byType('reversal')[0]).toMatchObject({ amount: '100.00', direction: 'debit' });
  });

  it('does not leak another tenant\'s documents', async () => {
    const rows = await buildStudentJournal(tenantA, {});
    expect(rows.some(r => r.amount === '9999.00')).toBe(false);
  });

  it('filters rows by date range', async () => {
    const rows = await buildStudentJournal(tenantA, { from: '2026-08-03', to: '2026-08-05' });
    const types = new Set(rows.map(r => r.type));
    expect(types.has('receipt')).toBe(true);
    expect(types.has('credit')).toBe(true);
    expect(types.has('invoice')).toBe(false);
    expect(rows.every(r => r.date >= '2026-08-03' && r.date <= '2026-08-05')).toBe(true);
  });
});
