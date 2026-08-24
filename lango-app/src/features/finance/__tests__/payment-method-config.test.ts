import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { validatePaymentMethod } from '@/libs/finance/payment-methods';
import { paymentMethodConfigurations, tenants } from '@/models/Schema';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);

function cfg(tenantId: string, over: Partial<typeof paymentMethodConfigurations.$inferInsert> = {}) {
  return {
    tenantId,
    methodCode: 'cmi',
    labelFr: 'Carte bancaire (CMI)',
    ...over,
  };
}

describe.skipIf(!hasDb)('payment-method configuration wiring (Phase H2)', () => {
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantA, name: 'Methods A', slug: `methods-a-${tenantA}` });
    await db.insert(tenants).values({ id: tenantB, name: 'Methods B', slug: `methods-b-${tenantB}` });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  it('accepts legacy built-in codes when the tenant has no configuration', async () => {
    for (const code of ['cash', 'card', 'transfer', 'check']) {
      await expect(validatePaymentMethod(tenantA, code)).resolves.toBeNull();
    }
  });

  it('rejects an unknown code when the tenant has no configuration', async () => {
    await expect(validatePaymentMethod(tenantA, 'bitcoin')).rejects.toMatchObject({
      status: 422,
      code: 'PAYMENT_METHOD_UNKNOWN',
    });
  });

  it('returns the matching config for an active configured method', async () => {
    await db.insert(paymentMethodConfigurations).values(cfg(tenantA, { provider: 'cmi-naps', gatewayMode: 'sandbox' }));
    const match = await validatePaymentMethod(tenantA, 'cmi');
    expect(match).not.toBeNull();
    expect(match!.provider).toBe('cmi-naps');
    expect(match!.gatewayMode).toBe('sandbox');
  });

  it('rejects an inactive configured method', async () => {
    await db.insert(paymentMethodConfigurations).values(cfg(tenantA, { methodCode: 'wire', isActive: false }));
    await expect(validatePaymentMethod(tenantA, 'wire')).rejects.toMatchObject({
      status: 422,
      code: 'PAYMENT_METHOD_INACTIVE',
    });
  });

  it('rejects a code absent from the tenant configuration once any config exists', async () => {
    // tenantA now has configuration rows, so legacy fallback no longer applies.
    await expect(validatePaymentMethod(tenantA, 'cash')).rejects.toMatchObject({
      status: 422,
      code: 'PAYMENT_METHOD_UNKNOWN',
    });
  });

  it('does not see another tenant\'s configuration', async () => {
    await db.insert(paymentMethodConfigurations).values(cfg(tenantB, { methodCode: 'other', provider: 'cmi-naps' }));
    await expect(validatePaymentMethod(tenantA, 'other')).rejects.toMatchObject({
      status: 422,
      code: 'PAYMENT_METHOD_UNKNOWN',
    });
  });
});
