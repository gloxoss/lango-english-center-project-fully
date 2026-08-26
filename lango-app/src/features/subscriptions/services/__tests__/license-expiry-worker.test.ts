import { and, eq, gt, isNotNull, lt, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { licensePayments, schoolLicenses, tenants, auditLogs } from '@/models/Schema';
import { runLicenseExpirySweep } from '../license-expiry-worker';

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

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('license-expiry-worker sweep', () => {
  const tenantId = crypto.randomUUID();
  const licenseId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Expiry Test School',
      slug: `expiry-test-${tenantId}`,
      subscriptionStatus: 'active',
      isActive: true,
    });

    await db.insert(schoolLicenses).values({
      id: licenseId,
      tenantId,
      licenseKey: `TEST-${licenseId.slice(0, 8).toUpperCase()}`,
      status: 'active',
      issuedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1 second ago
    });
  });

  afterAll(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(schoolLicenses).where(eq(schoolLicenses.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('suspends a tenant whose active license is expired with no paid renewal', async () => {
    const result = await runLicenseExpirySweep();
    expect(result.suspended).toBeGreaterThanOrEqual(1);

    const [tenant] = await db
      .select({ subscriptionStatus: tenants.subscriptionStatus })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    expect(tenant?.subscriptionStatus).toBe('suspended');
  });

  it('writes an audit row for the suspension', async () => {
    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.entityType, 'tenant')))
      .limit(1);
    expect(audit).toBeDefined();
    expect(audit!.action).toBe('update');
    expect((audit!.metadata as Record<string, unknown>)?.action).toBe('license_expired');
  });

  it('does not re-suspend an already-suspended tenant', async () => {
    const result = await runLicenseExpirySweep();
    expect(result.suspended).toBe(0);
  });
});
