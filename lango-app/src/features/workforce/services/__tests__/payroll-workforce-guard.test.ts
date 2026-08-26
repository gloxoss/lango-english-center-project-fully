// Payroll-workforce entitlement guard. requireWorkforceAddon() enforces BOTH
// the payroll-workforce entitlement AND its hard human-resources dependency, so
// a payroll route can never run in a tenant lacking the employee-profile
// foundation. Proven directly against a real DB.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
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

describe.skipIf(!dbReachable)('payroll-workforce entitlement guard', () => {
  const suffix = Date.now().toString(36);
  const tenantId = crypto.randomUUID();
  const adminId = `WF-GUARD-ADMIN-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Workforce Guard ${suffix}`, slug: `wf-guard-${suffix}` });
    await db.insert(user).values({ id: adminId, tenantId, name: 'Workforce Admin', email: `wf-guard-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' });
  }, 30_000);

  afterAll(async () => {
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('denies when payroll-workforce is not entitled', async () => {
    await expect(requireWorkforceAddon(tenantId)).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
  });

  it('denies when payroll-workforce is enabled but human-resources is missing (hard dependency)', async () => {
    await db.insert(addonEntitlements).values({ tenantId, addonId: 'payroll-workforce', isEnabled: true });
    await expect(requireWorkforceAddon(tenantId)).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
  });

  it('allows once BOTH payroll-workforce and human-resources are enabled', async () => {
    await db.insert(addonEntitlements).values({ tenantId, addonId: 'human-resources', isEnabled: true });
    await expect(requireWorkforceAddon(tenantId)).resolves.toBeUndefined();
  });
});
