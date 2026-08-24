import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { getTenantCurrency } from '@/libs/finance/currency';
import { settingValues, tenants } from '@/models/Schema';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('per-tenant currency (Phase H1)', () => {
  const tenantId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Currency Test', slug: `currency-${tenantId}` });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('defaults to MAD when no override exists', async () => {
    await expect(getTenantCurrency(tenantId)).resolves.toBe('MAD');
  });

  it('resolves a tenant override (EUR)', async () => {
    await db.insert(settingValues).values({
      tenantId,
      branchId: null,
      key: 'finance.currency',
      value: 'EUR',
      version: 1,
    });
    await expect(getTenantCurrency(tenantId)).resolves.toBe('EUR');
  });

  it('falls back to MAD for a tenant with no rows at all', async () => {
    const emptyTenant = crypto.randomUUID();
    await db.insert(tenants).values({ id: emptyTenant, name: 'Empty Currency', slug: `empty-currency-${emptyTenant}` });
    await expect(getTenantCurrency(emptyTenant)).resolves.toBe('MAD');
    await db.delete(tenants).where(eq(tenants.id, emptyTenant));
  });
});
