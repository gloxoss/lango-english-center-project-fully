// Broadcast-messaging entitlement guard. Every api/addons/broadcast/** route
// derives tenant from the session then calls broadcastGuard() (which chains
// requireAddon(tenantId, 'broadcast-messaging') + requireCapability). This
// proves the shared add-on gate denies/permits correctly against a real DB.
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

describe.skipIf(!dbReachable)('broadcast-messaging entitlement guard', () => {
  const suffix = Date.now().toString(36);
  const tenantId = crypto.randomUUID();
  const adminId = `BC-GUARD-ADMIN-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Broadcast Guard ${suffix}`, slug: `bc-guard-${suffix}` });
    await db.insert(user).values({ id: adminId, tenantId, name: 'Broadcast Admin', email: `bc-guard-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' });
  }, 30_000);

  afterAll(async () => {
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('denies with ADDON_NOT_ACTIVATED while no entitlement row exists', async () => {
    await expect(requireAddon(tenantId, 'broadcast-messaging')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
  });

  it('allows once enabled, then denies again after being disabled', async () => {
    await db.insert(addonEntitlements).values({ tenantId, addonId: 'broadcast-messaging', isEnabled: true });
    await expect(requireAddon(tenantId, 'broadcast-messaging')).resolves.toBeUndefined();

    await db.update(addonEntitlements).set({ isEnabled: false }).where(eq(addonEntitlements.tenantId, tenantId));
    await expect(requireAddon(tenantId, 'broadcast-messaging')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
  });
});
