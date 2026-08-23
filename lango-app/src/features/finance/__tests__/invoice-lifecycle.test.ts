import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createInvoice } from '@/app/api/finance/invoices/route';
import { POST as postPayment } from '@/app/api/finance/payments/route';
import { PUT as issueInvoice } from '@/app/api/finance/invoices/[id]/issue/route';
import { PUT as cancelInvoice } from '@/app/api/finance/invoices/[id]/cancel/route';
import { POST as creditInvoice } from '@/app/api/finance/invoices/[id]/credit/route';
import { GET as getStatements } from '@/app/api/finance/statements/route';
import { db } from '@/libs/DB';
import { invoiceItems, invoices, tenants, user } from '@/models/Schema';
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

function makeInvoiceRow(tenantId: string, studentId: string, netAmount: number, status: 'draft' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'credited', dueDate: string) {
  return {
    tenantId,
    studentId,
    invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    amount: netAmount,
    discountAmount: 0,
    netAmount,
    paidAmount: 0,
    status,
    dueDate,
  };
}

describe.skipIf(!hasDb)('invoice lifecycle (Phase D)', () => {
  const tenantId = crypto.randomUUID();
  const studentId = `USR-STU-${crypto.randomUUID()}`;

  function fakeContext(): RequestContext {
    return {
      userId: ADMIN_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Lifecycle Tester',
      email: 'lifecycle.tester@example.com',
    };
  }

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue(fakeContext());
    await db.insert(tenants).values({ id: tenantId, name: 'Lifecycle Test', slug: `lifecycle-${tenantId}` });
    await db.insert(user).values({ id: ADMIN_ID, tenantId, name: 'Lifecycle Admin', email: `adm-${tenantId}@test.local`, role: 'school_admin' });
    await db.insert(user).values({ id: studentId, tenantId, name: 'Lifecycle Student', email: `stu-${tenantId}@test.local`, role: 'student' });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  function createDraft(amount: number, dueDate: string) {
    return createInvoice(new Request('http://localhost/api/finance/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        amount,
        dueDate,
        status: 'draft',
        items: [{ description: 'Frais de scolarité', amount: String(amount) }],
      }),
    }));
  }

  function issue(id: string) {
    return issueInvoice(new Request('http://localhost/api/finance/invoices', { method: 'PUT' }), { params: Promise.resolve({ id }) });
  }

  function cancel(id: string) {
    return cancelInvoice(new Request('http://localhost/api/finance/invoices', { method: 'PUT' }), { params: Promise.resolve({ id }) });
  }

  function credit(id: string) {
    return creditInvoice(new Request('http://localhost/api/finance/invoices', { method: 'POST' }), { params: Promise.resolve({ id }) });
  }

  function pay(invoiceId: string, amount: string) {
    return postPayment(new Request('http://localhost/api/finance/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, amount, paymentMethod: 'card' }),
    }));
  }

  it('creates a draft invoice with items, then issues it', async () => {
    const res = await createDraft(200, '2026-12-31');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('draft');

    const [row] = await db.select().from(invoices).where(eq(invoices.id, json.data.id));
    expect(row!.status).toBe('draft');

    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, json.data.id));
    expect(items).toHaveLength(1);

    const issued = await issue(json.data.id);
    expect(issued.status).toBe(200);
    const ij = await issued.json();
    expect(ij.data.status).toBe('pending');
    expect(ij.data.issueDate).toBe(new Date().toISOString().slice(0, 10));
  });

  it('rejects issuing an already-issued invoice', async () => {
    const res = await createDraft(100, '2026-12-31');
    const id = (await res.json()).data.id;
    await issue(id);
    const again = await issue(id);
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe('INVOICE_NOT_DRAFT');
  });

  it('cancels a pending invoice and excludes it from statements', async () => {
    const studentStmt = `USR-STMT-${crypto.randomUUID()}`;
    await db.insert(user).values({ id: studentStmt, tenantId, name: 'Stmt Student', email: `stmt-${tenantId}@test.local`, role: 'student' });

    // One pending + one cancelled, both due in the past so they'd count as charges.
    const [pending] = await db.insert(invoices).values(makeInvoiceRow(tenantId, studentStmt, 100, 'pending', '2026-01-10')).returning();
    const [cancelled] = await db.insert(invoices).values(makeInvoiceRow(tenantId, studentStmt, 70, 'pending', '2026-01-15')).returning();
    const cancelRes = await cancel(cancelled!.id);
    expect(cancelRes.status).toBe(200);
    expect((await cancelRes.json()).data.status).toBe('cancelled');

    const statement = await getStatements(new NextRequest(`http://localhost/api/finance/statements?studentId=${studentStmt}`));
    const sj = await statement.json();
    expect(sj.success).toBe(true);
    // Only the pending invoice is a charge; the cancelled one is excluded.
    expect(sj.data.chargesTotal).toBe(100);
    expect(sj.data.transactions.filter((t: { type: string }) => t.type === 'invoice')).toHaveLength(1);
    void pending;
  });

  it('rejects cancelling an invoice that already collected money', async () => {
    const [fresh] = await db.insert(invoices).values(makeInvoiceRow(tenantId, studentId, 100, 'pending', '2026-12-31')).returning();
    const payRes = await pay(fresh!.id, '100.00');
    expect(payRes.status).toBe(200);

    const cancelRes = await cancel(fresh!.id);
    expect(cancelRes.status).toBe(409);
    expect((await cancelRes.json()).error.code).toBe('INVOICE_NOT_CANCELLABLE');
  });

  it('credits a partially paid invoice into a student credit', async () => {
    const [fresh] = await db.insert(invoices).values(makeInvoiceRow(tenantId, studentId, 300, 'pending', '2026-12-31')).returning();
    const payRes = await pay(fresh!.id, '100.00');
    expect(payRes.status).toBe(200);

    const creditRes = await credit(fresh!.id);
    expect(creditRes.status).toBe(200);
    const cj = await creditRes.json();
    expect(cj.data.creditCents).toBe('20000'); // outstanding balance in cents

    const [row] = await db.select().from(invoices).where(eq(invoices.id, fresh!.id));
    expect(row!.status).toBe('credited');

    const credits = await db.select().from(studentCredits)
      .where(and(eq(studentCredits.tenantId, tenantId), eq(studentCredits.studentId, studentId), eq(studentCredits.source, 'invoice_credit')));
    expect(credits).toHaveLength(1);
    expect(Number(credits[0]!.amount)).toBe(200);
    expect(Number(credits[0]!.balance)).toBe(200);
  });

  it('rejects crediting a cancelled invoice', async () => {
    const [fresh] = await db.insert(invoices).values(makeInvoiceRow(tenantId, studentId, 50, 'pending', '2026-12-31')).returning();
    await cancel(fresh!.id);

    const creditRes = await credit(fresh!.id);
    expect(creditRes.status).toBe(409);
    expect((await creditRes.json()).error.code).toBe('INVOICE_NOT_CREDITABLE');
  });

  it('rejects lifecycle actions on an invoice outside the tenant', async () => {
    const otherTenant = crypto.randomUUID();
    const otherStudent = `USR-Y-${crypto.randomUUID()}`;
    await db.insert(tenants).values({ id: otherTenant, name: 'Other Tenant', slug: `other-${otherTenant}` });
    await db.insert(user).values({ id: otherStudent, tenantId: otherTenant, name: 'Y', email: `y-${otherTenant}@test.local`, role: 'student' });
    const [foreign] = await db.insert(invoices).values(makeInvoiceRow(otherTenant, otherStudent, 100, 'draft', '2026-12-31')).returning();

    const res = await issue(foreign!.id);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('INVOICE_NOT_FOUND');
    await db.delete(tenants).where(eq(tenants.id, otherTenant));
  });
});
