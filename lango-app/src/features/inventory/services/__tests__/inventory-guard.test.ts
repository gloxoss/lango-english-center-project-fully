// Inventory entitlement guard for api/addons/inventory/** routes.
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

describe.skipIf(!dbReachable)('inventory entitlement guard', () => {
  const suffix = Date.now().toString(36);
  const tenantId = crypto.randomUUID();
  const adminId = `INV-GUARD-ADMIN-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Inventory Guard ${suffix}`, slug: `inv-guard-${suffix}` });
    await db.insert(user).values({ id: adminId, tenantId, name: 'Inventory Admin', email: `inv-guard-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' });
  }, 30_000);

  afterAll(async () => {
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('denies with ADDON_NOT_ACTIVATED while no entitlement row exists', async () => {
    await expect(requireAddon(tenantId, 'inventory')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
  });

  it('allows once enabled, then denies again after being disabled', async () => {
    await db.insert(addonEntitlements).values({ tenantId, addonId: 'inventory', isEnabled: true });
    await expect(requireAddon(tenantId, 'inventory')).resolves.toBeUndefined();

    await db.update(addonEntitlements).set({ isEnabled: false }).where(eq(addonEntitlements.tenantId, tenantId));
    await expect(requireAddon(tenantId, 'inventory')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
  });
});
