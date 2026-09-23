import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { invoices, tenants, user } from '@/models/Schema';
import { GET } from '@/app/api/accountant/me/receivables/route';
import { sendSingleInvoiceReminder } from '@/libs/services/finance-reminders';

const authState = vi.hoisted(() => ({ tenantId: '' }));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async () => ({ tenantId: authState.tenantId, role: 'accountant', branchId: null }),
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: async () => undefined }));

const available = await db.execute(sql`select 1`).then(() => true, () => false);

describe.skipIf(!available)('receivables aging', () => {
  const tenantId = randomUUID();
  const studentId = `AGING-${tenantId}`;
  const today = casablancaTodayIso();
  const yesterdayDate = new Date(`${today}T12:00:00Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 14);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const futureDate = new Date(`${today}T12:00:00Z`);
  futureDate.setUTCDate(futureDate.getUTCDate() + 14);
  const future = futureDate.toISOString().slice(0, 10);
  let futureInvoiceId: string;

  beforeAll(async () => {
    authState.tenantId = tenantId;
    await db.insert(tenants).values({ id: tenantId, name: 'Aging Test', slug: `aging-${tenantId}` });
    await db.insert(user).values({ id: studentId, tenantId, name: 'Student', email: `${studentId}@example.test`, role: 'student' });
    const rows = await db.insert(invoices).values([
      { tenantId, studentId, invoiceNumber: 'AGING-OLD', amount: 3000, netAmount: 3000, paidAmount: 0, dueDate: yesterday, status: 'pending' },
      { tenantId, studentId, invoiceNumber: 'AGING-FUTURE', amount: 3000, netAmount: 3000, paidAmount: 0, dueDate: future, status: 'pending' },
    ]).returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber });
    futureInvoiceId = rows.find((row) => row.invoiceNumber === 'AGING-FUTURE')!.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('separates future balances from overdue balances and rejects a premature SMS', async () => {
    const response = await GET(new NextRequest('http://localhost/api/accountant/me/receivables'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.summary).toMatchObject({ totalOutstanding: 6000, notDue: 3000, current030: 3000, totalCount: 2 });
    expect(body.data.invoices.find((row: { id: string }) => row.id === futureInvoiceId)).toMatchObject({ isOverdue: false, daysOverdue: 0 });
    await expect(sendSingleInvoiceReminder(tenantId, futureInvoiceId, null)).rejects.toMatchObject({ status: 409, code: 'INVOICE_NOT_OVERDUE' });
  });
});
