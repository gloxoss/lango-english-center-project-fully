// Hostel entitlement guard + `state=all` filter regression (§19.11).
//
// Guard: `requireAddon(tenantId, 'hostel')` is the shared gate behind every
// api/addons/hostel/** route (allocations, roll-call, visitors, incidents,
// charges, …). We prove the boundary deny/allow directly against a real DB.
//
// Regression: listAllocations() must treat the UI's 'all' sentinel (and any
// other non-enum value) as "no state filter", not emit an invalid enum
// comparison that throws — the fix that was silently regressing before §19.11.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireAddon } from '@/libs/api/entitlements';
import { addonEntitlements, tenants, user } from '@/models/Schema';
import { commitAllocation, checkInAllocation, listAllocations } from '@/features/hostel/services/allocation-service';
import { dateString } from '@/features/hostel/services/inventory-service';
import {
  hostelAllocationEvents,
  hostelAllocations,
  hostelBeds,
  hostelRoomCategories,
  hostelRooms,
  hostels,
} from '@/features/hostel/models/hostel-schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('hostel entitlement + allocation state filter', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const adminId = `HST-GUARD-ADMIN-${suffix}`;
  const studentId = `HST-GUARD-STU-${suffix}`;
  const studentId2 = `HST-GUARD-STU2-${suffix}`;

  const today = dateString();
  const endDate = (() => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + 90);
    return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
  })();

  let bed1 = '';
  let bed2 = '';

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Hostel Guard ${suffix}`, slug: `hst-guard-${suffix}` });
    await db.insert(user).values([
      { id: adminId, tenantId, name: 'Guard Admin', email: `hst-guard-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentId, tenantId, name: 'Guard Student', email: `hst-guard-stu-${suffix}@test.local`, role: 'student', userStatus: 'active' },
      { id: studentId2, tenantId, name: 'Guard Student 2', email: `hst-guard-stu2-${suffix}@test.local`, role: 'student', userStatus: 'active' },
    ]);
    const [category] = await db.insert(hostelRoomCategories).values({
      tenantId, name: 'Standard', code: `HGC-${suffix}`, baseCharge: '1800.00', depositAmount: '500.00', status: 'active',
    }).returning({ id: hostelRoomCategories.id });
    const [hostel] = await db.insert(hostels).values({
      tenantId, code: `HG-${suffix}`, name: 'Résidence Guard', status: 'active', genderPolicy: 'mixed',
    }).returning({ id: hostels.id });
    const [room] = await db.insert(hostelRooms).values({
      tenantId, hostelId: hostel!.id, categoryId: category!.id, code: `HGR-${suffix}`, name: 'Chambre', status: 'active',
    }).returning({ id: hostelRooms.id });
    bed1 = (await db.insert(hostelBeds).values({ tenantId, roomId: room!.id, code: `B1-${suffix}`, status: 'active' }).returning({ id: hostelBeds.id }))[0]!.id;
    bed2 = (await db.insert(hostelBeds).values({ tenantId, roomId: room!.id, code: `B2-${suffix}`, status: 'active' }).returning({ id: hostelBeds.id }))[0]!.id;
  }, 30_000);

  afterAll(async () => {
    await db.delete(hostelAllocationEvents).where(eq(hostelAllocationEvents.tenantId, tenantId));
    await db.delete(hostelAllocations).where(eq(hostelAllocations.tenantId, tenantId));
    await db.delete(hostelBeds).where(eq(hostelBeds.tenantId, tenantId));
    await db.delete(hostelRooms).where(eq(hostelRooms.tenantId, tenantId));
    await db.delete(hostelRoomCategories).where(eq(hostelRoomCategories.tenantId, tenantId));
    await db.delete(hostels).where(eq(hostels.tenantId, tenantId));
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  describe('entitlement guard', () => {
    it('denies with ADDON_NOT_ACTIVATED while no entitlement row exists', async () => {
      await expect(requireAddon(tenantId, 'hostel')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });
    });

    it('allows once enabled, then denies again after being disabled', async () => {
      await db.insert(addonEntitlements).values({ tenantId, addonId: 'hostel', isEnabled: true });
      await expect(requireAddon(tenantId, 'hostel')).resolves.toBeUndefined();

      await db.update(addonEntitlements).set({ isEnabled: false }).where(eq(addonEntitlements.tenantId, tenantId));
      await expect(requireAddon(tenantId, 'hostel')).rejects.toMatchObject({ code: 'ADDON_NOT_ACTIVATED' });

      // Re-enable for the state-filter tests below.
      await db.update(addonEntitlements).set({ isEnabled: true }).where(eq(addonEntitlements.tenantId, tenantId));
    });
  });

  describe('state=all filter regression (§19.11)', () => {
    beforeAll(async () => {
      // One reserved allocation and one checked-in allocation in distinct beds.
      const reserved = await commitAllocation(tenantId, adminId, {
        studentId, bedId: bed1, effectiveStartDate: today, effectiveEndDate: endDate,
      });
      expect(reserved.state).toBe('reserved');

      const active = await commitAllocation(tenantId, adminId, {
        studentId: studentId2, bedId: bed2, effectiveStartDate: today, effectiveEndDate: endDate,
      });
      await checkInAllocation(tenantId, adminId, active.id);
    });

    it("treats the 'all' sentinel as no filter (returns every state, no throw)", async () => {
      const rows = await listAllocations(tenantId, { state: 'all' });
      const states = new Set(rows.map(r => r.state));
      expect(states.has('reserved')).toBe(true);
      expect(states.has('checked_in')).toBe(true);
    });

    it('ignores an unknown non-enum state instead of emitting an invalid enum comparison', async () => {
      const rows = await listAllocations(tenantId, { state: 'not-a-real-state' });
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('still filters precisely for a real enum state', async () => {
      const rows = await listAllocations(tenantId, { state: 'checked_in' });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.state).toBe('checked_in');
    });
  });
});
