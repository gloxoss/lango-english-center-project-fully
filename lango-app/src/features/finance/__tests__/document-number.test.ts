import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { consumeDocumentNumber } from '@/libs/finance/document-number';
import { namingSeries, tenants } from '@/models/Schema';

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

describe.skipIf(!hasDb)('consumeDocumentNumber', () => {
  const tenantId = crypto.randomUUID();
  const year = new Date().getFullYear();
  const basePrefix = `TST-${year}-`;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Doc Number Test', slug: `docnum-${tenantId}` });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('emits sequential numbers, zero-padded', async () => {
    const a = await db.transaction(tx => consumeDocumentNumber(tx, { tenantId, prefix: basePrefix }));
    const b = await db.transaction(tx => consumeDocumentNumber(tx, { tenantId, prefix: basePrefix }));
    expect(a).toBe(`${basePrefix}0001`);
    expect(b).toBe(`${basePrefix}0002`);
  });

  it('serializes concurrent consumption so numbers are never duplicated', async () => {
    const prefix = `${basePrefix}CONC-`;
    const results = await Promise.all(
      Array.from({ length: 10 }, () => db.transaction(tx => consumeDocumentNumber(tx, { tenantId, prefix }))),
    );
    expect(new Set(results).size).toBe(10);
    for (let i = 1; i <= 10; i++) {
      expect(results).toContain(`${prefix}${String(i).padStart(4, '0')}`);
    }
  });

  it('respects start, step and padStart', async () => {
    const prefix = `${basePrefix}PAD-`;
    const a = await db.transaction(tx => consumeDocumentNumber(tx, { tenantId, prefix, start: 10, step: 5, padStart: 3 }));
    const b = await db.transaction(tx => consumeDocumentNumber(tx, { tenantId, prefix, start: 10, step: 5, padStart: 3 }));
    expect(a).toBe(`${prefix}010`);
    expect(b).toBe(`${prefix}015`);
  });

  it('continues from an existing series whose current_val is the last issued number', async () => {
    const prefix = `${basePrefix}SEED-`;
    await db.insert(namingSeries).values({ tenantId, prefix, currentVal: 42 });
    const next = await db.transaction(tx => consumeDocumentNumber(tx, { tenantId, prefix }));
    expect(next).toBe(`${prefix}0043`);
  });
});
