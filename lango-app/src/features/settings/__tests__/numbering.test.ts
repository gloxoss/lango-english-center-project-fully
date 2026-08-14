import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { tenants, user } from '@/models/Schema';
import type { RequestContext } from '@/libs/api/context';
import {
  consumeNextNumber,
  createNumberingSeries,
  previewNextNumber,
  updateNumberingSeries,
} from '../services/numbering-service';

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
const USER_ID = `USR-NUM-${crypto.randomUUID()}`;

function fakeContext(tenantId: string): RequestContext {
  return {
    userId: USER_ID,
    tenantId,
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Numbering Tester',
    email: 'numbering.tester@example.com',
  };
}

describe.skipIf(!hasDb)('numbering series registry', () => {
  const tenantId = crypto.randomUUID();
  const ctx = () => fakeContext(tenantId);

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Numbering Test', slug: `numbering-${tenantId}` });
    await db.insert(user).values({
      id: USER_ID, tenantId, name: 'Numbering Tester', email: `numbering-${tenantId}@test.local`, role: 'school_admin', userStatus: 'active',
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('creates a series whose first emitted number is the configured start, zero-padded', async () => {
    const created = await createNumberingSeries(ctx(), {
      key: 'invoice',
      name: 'Factures 2026',
      prefix: 'FAC-',
      padding: 6,
      start: 1,
      step: 1,
    });
    expect(created.current).toBe(0);
    expect(created.nextValue).toBe('FAC-000001');

    const consumed = await consumeNextNumber(ctx(), created.id);
    expect(consumed.numericValue).toBe(1);
    expect(consumed.nextValue).toBe('FAC-000001');

    const second = await consumeNextNumber(ctx(), created.id);
    expect(second.numericValue).toBe(2);
    expect(second.nextValue).toBe('FAC-000002');
  });

  it('preview does not consume the sequence', async () => {
    const created = await createNumberingSeries(ctx(), {
      key: 'matricule',
      name: 'Matricules',
      prefix: 'STU-',
      padding: 3,
      start: 10,
      step: 5,
    });
    const preview = await previewNextNumber(ctx(), created.id);
    expect(preview.numericValue).toBe(10);
    expect(preview.nextValue).toBe('STU-010');

    const consumed = await consumeNextNumber(ctx(), created.id);
    expect(consumed.numericValue).toBe(10);

    const preview2 = await previewNextNumber(ctx(), created.id);
    expect(preview2.numericValue).toBe(15);
    expect(preview2.nextValue).toBe('STU-015');
  });

  it('serializes concurrent consumption so numbers are never duplicated', async () => {
    const created = await createNumberingSeries(ctx(), {
      key: 'concurrent',
      name: 'Série concurrente',
      start: 1,
      step: 1,
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeNextNumber(ctx(), created.id)),
    );

    const numericValues = results.map(r => r.numericValue);
    expect(new Set(numericValues).size).toBe(10);
    for (let i = 1; i <= 10; i++) {
      expect(numericValues).toContain(i);
    }

    // The series row reflects the last consumed value.
    const preview = await previewNextNumber(ctx(), created.id);
    expect(preview.current).toBe(10);
    expect(preview.numericValue).toBe(11);
  });

  it('update bumps the version history but keeps consumption continuity', async () => {
    const created = await createNumberingSeries(ctx(), {
      key: 'update-flow',
      name: 'Avant mise à jour',
      prefix: 'X-',
      start: 1,
      step: 1,
    });
    await consumeNextNumber(ctx(), created.id); // current = 1

    const updated = await updateNumberingSeries(ctx(), created.id, {
      name: 'Après mise à jour',
      suffix: '/B',
    });
    expect(updated.current).toBe(1);

    const consumed = await consumeNextNumber(ctx(), created.id);
    expect(consumed.numericValue).toBe(2);
    expect(consumed.nextValue).toBe('X-2/B');
  });

  it('rejects a duplicate key within the same tenant', async () => {
    await createNumberingSeries(ctx(), { key: 'dupe-key', name: 'Premier' });
    await expect(
      createNumberingSeries(ctx(), { key: 'dupe-key', name: 'Second' }),
    ).rejects.toThrow();
  });
});
