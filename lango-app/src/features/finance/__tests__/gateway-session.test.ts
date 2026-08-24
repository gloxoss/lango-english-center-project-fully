import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as StartOnline } from '@/app/api/finance/payments/online/route';
import { POST as Callback } from '@/app/api/finance/payments/online/callback/route';
import { db } from '@/libs/DB';
import { invoices, paymentMethodConfigurations, payments, tenants, user } from '@/models/Schema';
import { paymentGatewaySessions } from '@/features/finance/models/student-accounting-schema';
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
const ADMIN_ID = `USR-GW-ADM-${crypto.randomUUID()}`;
const STUDENT_ID = `USR-GW-STU-${crypto.randomUUID()}`;

describe.skipIf(!hasDb)('online gateway sessions (Phase H3)', () => {
  const tenantId = crypto.randomUUID();
  let invoiceId = '';

  function fakeContext(): RequestContext {
    return {
      userId: ADMIN_ID,
      tenantId,
      branchId: null,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Gateway Tester',
      email: 'gateway.tester@example.com',
    };
  }

  function jsonPost(url: string, body: unknown): Request {
    return new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function createInvoice(): Promise<string> {
    const [inv] = await db.insert(invoices).values({
      tenantId,
      studentId: STUDENT_ID,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: 300,
      discountAmount: 0,
      netAmount: 300,
      paidAmount: 0,
      status: 'pending',
      dueDate: '2026-12-31',
    }).returning();
    return inv!.id;
  }

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue(fakeContext());
    await db.insert(tenants).values({ id: tenantId, name: 'Gateway Test', slug: `gateway-${tenantId}` });
    await db.insert(user).values({ id: ADMIN_ID, tenantId, name: 'Gateway Admin', email: `gw-adm-${tenantId}@test.local`, role: 'school_admin' });
    await db.insert(user).values({ id: STUDENT_ID, tenantId, name: 'Gateway Student', email: `gw-stu-${tenantId}@test.local`, role: 'student' });

    const [inv] = await db.insert(invoices).values({
      tenantId,
      studentId: STUDENT_ID,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: 300,
      discountAmount: 0,
      netAmount: 300,
      paidAmount: 0,
      status: 'pending',
      dueDate: '2026-12-31',
    }).returning();
    invoiceId = inv!.id;

    await db.insert(paymentMethodConfigurations).values({
      tenantId,
      methodCode: 'cmi',
      labelFr: 'Carte bancaire (CMI)',
      provider: 'cmi-naps',
      gatewayMode: 'sandbox',
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('starts a sandbox session with a null redirect (simulator drives the callback)', async () => {
    const res = await StartOnline(jsonPost('http://localhost/api/finance/payments/online', {
      invoiceId,
      paymentMethod: 'cmi',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.redirectUrl).toBeNull();
    expect(json.data.externalReference).toMatch(/^GW-/);
    expect(json.data.mode).toBe('sandbox');

    const [session] = await db.select().from(paymentGatewaySessions)
      .where(eq(paymentGatewaySessions.externalReference, json.data.externalReference));
    expect(session!.status).toBe('pending');
    expect(Number(session!.amount)).toBe(300);
  });

  it('posts the payment on a paid callback and marks the session paid', async () => {
    const start = await StartOnline(jsonPost('http://localhost/api/finance/payments/online', {
      invoiceId,
      paymentMethod: 'cmi',
    }));
    const { externalReference } = (await start.json()).data;

    const res = await Callback(jsonPost('http://localhost/api/finance/payments/online/callback', {
      externalReference,
      amount: 300,
      currency: 'MAD',
      status: 'paid',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('paid');
    expect(json.data.paymentId).toBeTruthy();

    const [payment] = await db.select().from(payments).where(eq(payments.id, json.data.paymentId));
    expect(payment!.paymentMethod).toBe('cmi');
    expect(payment!.referenceId).toBe(externalReference);

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    expect(inv!.status).toBe('paid');
    expect(Number(inv!.paidAmount)).toBe(300);

    const [session] = await db.select().from(paymentGatewaySessions)
      .where(eq(paymentGatewaySessions.externalReference, externalReference));
    expect(session!.status).toBe('paid');
    expect(session!.paymentId).toBe(json.data.paymentId);
  });

  it('acknowledges a replayed callback without double-posting', async () => {
    const freshInvoice = await createInvoice();
    const start = await StartOnline(jsonPost('http://localhost/api/finance/payments/online', {
      invoiceId: freshInvoice,
      paymentMethod: 'cmi',
    }));
    const { externalReference } = (await start.json()).data;
    const body = { externalReference, amount: 300, currency: 'MAD', status: 'paid' };

    const first = await Callback(jsonPost('http://localhost/api/finance/payments/online/callback', body));
    expect(first.status).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.data.status).toBe('paid');

    const paymentCountBefore = (await db.select().from(payments).where(eq(payments.tenantId, tenantId))).length;

    const second = await Callback(jsonPost('http://localhost/api/finance/payments/online/callback', body));
    expect(second.status).toBe(200);
    const secondJson = await second.json();
    expect(secondJson.data.status).toBe('paid');
    expect(secondJson.message).toContain('Déjà traité');

    const paymentCountAfter = (await db.select().from(payments).where(eq(payments.tenantId, tenantId))).length;
    expect(paymentCountAfter).toBe(paymentCountBefore);
  });

  it('marks the session failed on a failed callback without posting a payment', async () => {
    const freshInvoice = await createInvoice();
    const start = await StartOnline(jsonPost('http://localhost/api/finance/payments/online', {
      invoiceId: freshInvoice,
      paymentMethod: 'cmi',
    }));
    const { externalReference } = (await start.json()).data;

    const res = await Callback(jsonPost('http://localhost/api/finance/payments/online/callback', {
      externalReference,
      amount: 300,
      currency: 'MAD',
      status: 'failed',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('failed');

    const [session] = await db.select().from(paymentGatewaySessions)
      .where(eq(paymentGatewaySessions.externalReference, externalReference));
    expect(session!.status).toBe('failed');
    expect(session!.paymentId).toBeNull();
  });

  it('rejects an invoice from another tenant', async () => {
    const other = crypto.randomUUID();
    const otherStudent = `USR-GW-STU-${crypto.randomUUID()}`;
    await db.insert(tenants).values({ id: other, name: 'Other GW', slug: `gw-other-${other}` });
    await db.insert(user).values({ id: otherStudent, tenantId: other, name: 'Other Student', email: `gw-other-stu-${other}@test.local`, role: 'student' });
    const [foreign] = await db.insert(invoices).values({
      tenantId: other,
      studentId: otherStudent,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: 100,
      discountAmount: 0,
      netAmount: 100,
      paidAmount: 0,
      status: 'pending',
      dueDate: '2026-12-31',
    }).returning();

    const res = await StartOnline(jsonPost('http://localhost/api/finance/payments/online', {
      invoiceId: foreign!.id,
      paymentMethod: 'cmi',
    }));
    expect(res.status).toBe(404);
    await db.delete(tenants).where(eq(tenants.id, other));
  });
});
