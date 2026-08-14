import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import type { RequestContext } from '@/libs/api/context';
import { addonEntitlements, branches, tenants, user, userPermissionOverrides } from '@/models/Schema';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('library entitlement + capability gates', () => {
  const suffix = randomUUID().slice(0, 8);
  let tenantId = '';
  let branchId = '';
  let librarianId = '';

  function ctx(userId: string, role: 'librarian' | 'school_admin'): RequestContext {
    return { userId, tenantId, branchId: null, role, baseRole: role, name: 'Guard User', email: `${userId}@test.local` };
  }

  beforeAll(async () => {
    const [tenant] = await db.insert(tenants).values({ name: `ACC Guard ${suffix}`, slug: `acc-guard-${suffix}` }).returning();
    tenantId = tenant!.id;
    const [branch] = await db.insert(branches).values({ tenantId, name: 'Main', code: `GU${suffix}` }).returning();
    branchId = branch!.id;
    librarianId = `acc-guard-librarian-${suffix}`;
    await db.insert(user).values([
      { id: librarianId, tenantId, branchId, email: `${librarianId}@test.local`, name: 'Guard Librarian', role: 'librarian' },
      { id: `acc-guard-admin-${suffix}`, tenantId, branchId, email: `acc-guard-admin-${suffix}@test.local`, name: 'Guard Admin', role: 'school_admin' },
    ]);
  }, 30_000);

  afterAll(async () => {
    if (tenantId) {
      await db.delete(userPermissionOverrides).where(eq(userPermissionOverrides.tenantId, tenantId));
      await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
      await db.delete(user).where(eq(user.tenantId, tenantId));
      await db.delete(branches).where(eq(branches.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
  }, 30_000);

  it('denies with ADDON_NOT_ACTIVATED while disabled and passes when enabled, preserving accounts', async () => {
    // No entitlement row → identical deny (never reveals which state).
    await expect(requireAddon(tenantId, 'library')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });

    await db.insert(addonEntitlements).values({ tenantId, addonId: 'library', isEnabled: true });
    await expect(requireAddon(tenantId, 'library')).resolves.toBeUndefined();

    await db.update(addonEntitlements).set({ isEnabled: false }).where(eq(addonEntitlements.tenantId, tenantId));
    await expect(requireAddon(tenantId, 'library')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });

    // Disabling the add-on never touches user accounts — librarian identity survives.
    const [librarian] = await db.select().from(user).where(eq(user.id, librarianId));
    expect(librarian?.role).toBe('librarian');
  });

  it('gates capability: librarian denied sensitive keys, granted operational keys', async () => {
    const librarian = ctx(librarianId, 'librarian');
    await expect(requireCapability(librarian, 'library.circulation.operate')).resolves.toBeUndefined();
    await expect(requireCapability(librarian, 'library.catalog.read')).resolves.toBeUndefined();
    await expect(requireCapability(librarian, 'library.charge.waive')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(requireCapability(librarian, 'library.circulation.override')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(requireCapability(librarian, 'library.stocktake.approve')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('school_admin holds all library capabilities; a user override grants one key', async () => {
    const admin = ctx(`acc-guard-admin-${suffix}`, 'school_admin');
    await expect(requireCapability(admin, 'library.charge.waive')).resolves.toBeUndefined();

    // Positive override path: tenant grants the sensitive key to the librarian directly.
    await db.insert(userPermissionOverrides).values({ tenantId, userId: librarianId, permissionId: 'library.charge.waive', granted: true });
    await expect(requireCapability(ctx(librarianId, 'librarian'), 'library.charge.waive')).resolves.toBeUndefined();
  });
});
