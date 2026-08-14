import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/finance/invoices/route';
import { db } from '@/libs/DB';
import { invoiceEvents, tenants, user } from '@/models/Schema';
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
const USER_ID = `USR-INV-${crypto.randomUUID()}`;

describe.skipIf(!hasDb)('invoice create (Phase A)', () => {
  const tenantId = crypto.randomUUID();
  const studentId = `USR-STU-${crypto.randomUUID()}`;

  function fakeContext(): RequestContext {
    return {
      userId: USER_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Invoice Tester',
      email: 'invoice.tester@example.com',
    };
  }

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue(fakeContext());
    await db.insert(tenants).values({ id: tenantId, name: 'Invoice Test', slug: `invoice-${tenantId}` });
    await db.insert(user).values({ id: studentId, tenantId, name: 'Test Student', email: `student-${tenantId}@test.local`, role: 'student' });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  function postInvoice(body: unknown) {
    return POST(new Request('http://localhost/api/finance/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  it('issues sequential invoice numbers, stores BigInt-safe money, and writes a created event', async () => {
    const res1 = await postInvoice({ studentId, amount: '1500.00', discountAmount: 100, dueDate: '2026-12-31' });
    expect(res1.status).toBe(200);
    const j1 = await res1.json();
    expect(j1.success).toBe(true);
    expect(j1.data.invoiceNumber).toMatch(/^INV-\d{4}-\d+$/);
    expect(j1.data.netAmount).toBe(1400);
    expect(j1.data.discountAmount).toBe(100);

    const num1Suffix = Number(j1.data.invoiceNumber.split('-').pop());
    const res2 = await postInvoice({ studentId, amount: '50.00', dueDate: '2026-12-31' });
    expect(res2.status).toBe(200);
    const j2 = await res2.json();
    expect(j2.data.invoiceNumber).toBe(`INV-${new Date().getFullYear()}-${String(num1Suffix + 1).padStart(4, '0')}`);
    expect(j2.data.netAmount).toBe(50);

    const events = await db.select().from(invoiceEvents).where(eq(invoiceEvents.invoiceId, j1.data.id));
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe('created');
  });

  it('rejects a discount that exceeds the amount', async () => {
    const res = await postInvoice({ studentId, amount: '100.00', discountAmount: 200, dueDate: '2026-12-31' });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error.code).toBe('DISCOUNT_EXCEEDS_AMOUNT');
  });

  it('derives overdue at read time for a past-due unpaid invoice', async () => {
    const res = await postInvoice({ studentId, amount: '300.00', dueDate: '2020-01-01' });
    const j = await res.json();
    const detailRes = await GET(new Request(`http://localhost/api/finance/invoices?id=${j.data.id}`));
    const detail = await detailRes.json();
    expect(detail.data.effectiveStatus).toBe('overdue');
  });
});
