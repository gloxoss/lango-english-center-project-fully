// Attachments-book entitlement guard. Every api/content/** route (assets,
// attachment-types) calls requireAddon(tenantId, 'attachments-book') after
// requireTenant. This proves that gate denies/permits correctly against a real
// DB, so a revoked entitlement can never leave the resource library reachable.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireAddon } from '@/libs/api/entitlements';
import { addonEntitlements, tenants, user } from '@/models/Schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('attachments-book entitlement guard', () => {
  const suffix = Date.now().toString(36);
  const tenantId = crypto.randomUUID();
  const adminId = `ATT-GUARD-ADMIN-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Attachments Guard ${suffix}`, slug: `att-guard-${suffix}` });
    await db.insert(user).values({ id: adminId, tenantId, name: 'Attachments Admin', email: `att-guard-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' });
  }, 30_000);

  afterAll(async () => {
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('denies with ADDON_NOT_ACTIVATED while no entitlement row exists', async () => {
    await expect(requireAddon(tenantId, 'attachments-book')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
  });

  it('allows once enabled, then denies again after being disabled', async () => {
    await db.insert(addonEntitlements).values({ tenantId, addonId: 'attachments-book', isEnabled: true });
    await expect(requireAddon(tenantId, 'attachments-book')).resolves.toBeUndefined();

    await db.update(addonEntitlements).set({ isEnabled: false }).where(eq(addonEntitlements.tenantId, tenantId));
    await expect(requireAddon(tenantId, 'attachments-book')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
  });
});
