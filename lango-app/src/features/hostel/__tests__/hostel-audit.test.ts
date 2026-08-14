// Hostel audit regression suite — proves the 10 required fixes from the
// independent audit live in the real services against a real database:
//   1. Transfer self-overlap (excludeAllocationId + locked source)
//   2. Checkout idempotency + no duplicate Finance posting
//   3. Bulk commit cross-tenant student protection
//   4. Application/student binding + date-window validation
//   5. Atomic state + event writes (transactional lifecycle)
//   6. Same-day checkout keeps effective_end_date > effective_start_date
//   7. Application foreign-reference tenant validation
//   8. Self-service leave-pass allowlist (no reason / createdById)
//   9. Invoice-number race (tenant-scoped atomic namingSeries upsert)
//  10. Leave-approval race (row lock serializes concurrent decisions)
//
// Follows the tenant-isolation.test.ts convention: skipped unless a real
// DATABASE_URL is present, using genuinely seeded fixtures (never mocks).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { invoiceItems, invoices, namingSeries, tenants, user } from '@/models/Schema';
import {
  hostelAllocationEvents,
  hostelAllocations,
  hostelApplications,
  hostelBeds,
  hostelChargeLinks,
  hostelLeavePassApprovals,
  hostelLeavePassReturns,
  hostelLeavePasses,
  hostelRoomCategories,
  hostelRooms,
  hostels,
  hostelZones,
  hostelPolicies,
} from '@/features/hostel/models/hostel-schema';
import {
  bulkCommitAllocations,
  cancelAllocation,
  checkInAllocation,
  checkOutAllocation,
  commitAllocation,
  createApplication,
  decideApplication,
  listAllocationEvents,
  transferAllocation,
} from '@/features/hostel/services/allocation-service';
import { emitCharge } from '@/features/hostel/server/finance-adapter';
import { dateString } from '@/features/hostel/services/inventory-service';
import {
  createLeavePass,
  decideLeavePass,
  listLeavePassesForSelf,
} from '@/features/hostel/services/leave-passes-service';

const hasDb = Boolean(process.env.DATABASE_URL);

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

function expectApiError<T>(promise: Promise<T>, status: number, code: string): Promise<void> {
  return promise.then(
    () => { throw new Error(`expected ApiError ${code} but call succeeded`); },
    (err) => {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(status);
      expect((err as ApiError).code).toBe(code);
    },
  );
}

describe.skipIf(!hasDb)('Hostel audit fixes', () => {
  const suffix = Date.now().toString(36);
  const tenantAId = crypto.randomUUID();
  const tenantBId = crypto.randomUUID();
  const adminAId = `HST-ADMIN-A-${suffix}`;
  const adminBId = `HST-ADMIN-B-${suffix}`;
  const studentAId = `HST-STU-A-${suffix}`;
  const studentBId = `HST-STU-B-${suffix}`;

  const today = dateString();
  const endDate = addDays(today, 90);

  let hostelAId: string;
  let hostelBId: string;
  let roomAId: string;
  let foreignRoomId: string; // tenant B's room (used as a cross-tenant reference)
  let roomCId: string;
  let bedA1: string; // roomA
  let bedB1: string; // roomC (transfer target)
  let bedC1: string; // roomC
  let categoryAId: string;

  async function seedTenant(tenantId: string, adminId: string) {
    await db.insert(tenants).values({ id: tenantId, name: `Hst Audit ${suffix}`, slug: `hst-audit-${suffix}-${tenantId.slice(0, 6)}` });
    await db.insert(user).values({
      id: adminId, tenantId, name: 'Audit Admin', email: `admin-${adminId}@test.local`,
      role: 'school_admin', userStatus: 'active',
    });
    const category = await db.insert(hostelRoomCategories).values({
      tenantId, name: 'Standard', code: `STD-${tenantId.slice(0, 4)}`,
      baseCharge: '1800.00', depositAmount: '500.00', status: 'active',
    }).returning({ id: hostelRoomCategories.id });
    const hostel = await db.insert(hostels).values({
      tenantId, code: `H-${tenantId.slice(0, 4)}`, name: 'Résidence Audit', status: 'active',
      genderPolicy: 'mixed',
    }).returning({ id: hostels.id });
    const room = await db.insert(hostelRooms).values({
      tenantId, hostelId: hostel[0]!.id, categoryId: category[0]!.id,
      code: `R-${tenantId.slice(0, 4)}`, name: 'Chambre', status: 'active',
    }).returning({ id: hostelRooms.id });
    return { hostelId: hostel[0]!.id, roomId: room[0]!.id, categoryId: category[0]!.id };
  }

  async function addBed(tenantId: string, roomId: string, code: string): Promise<string> {
    const row = await db.insert(hostelBeds).values({
      tenantId, roomId, code, status: 'active',
    }).returning({ id: hostelBeds.id });
    return row[0]!.id;
  }

  async function seedStudent(tenantId: string, studentId: string, gender: 'male' | 'female' | 'other' = 'male') {
    await db.insert(user).values({
      id: studentId, tenantId, name: 'Étudiant Audit', email: `stu-${studentId}@test.local`,
      role: 'student', userStatus: 'active', dateOfBirth: '2000-01-01', gender,
    });
  }

  async function makeCheckedInAllocation(tenantId: string, studentId: string, bedId: string): Promise<{ id: string }> {
    const allocated = await commitAllocation(tenantId, adminAId, {
      studentId, bedId, effectiveStartDate: today, effectiveEndDate: endDate,
    });
    await checkInAllocation(tenantId, adminAId, allocated.id);
    return { id: allocated.id };
  }

  // Tests reuse the two seeded students/beds, so each test starts with a clean
  // allocation slate. This keeps the active-allocation invariant (a student or
  // bed can hold at most one overlapping active allocation) from leaking state
  // between tests. Tenants, students, beds and rooms survive the wipe.
  async function clearAllocations(tenantId: string) {
    await db.delete(hostelChargeLinks).where(eq(hostelChargeLinks.tenantId, tenantId));
    await db.delete(hostelLeavePassApprovals).where(eq(hostelLeavePassApprovals.tenantId, tenantId));
    await db.delete(hostelLeavePassReturns).where(eq(hostelLeavePassReturns.tenantId, tenantId));
    await db.delete(hostelLeavePasses).where(eq(hostelLeavePasses.tenantId, tenantId));
    await db.delete(hostelAllocationEvents).where(eq(hostelAllocationEvents.tenantId, tenantId));
    await db.delete(hostelAllocations).where(eq(hostelAllocations.tenantId, tenantId));
    await db.delete(hostelApplications).where(eq(hostelApplications.tenantId, tenantId));
  }

  async function cleanupTenant(tenantId: string) {
    await db.delete(hostelChargeLinks).where(eq(hostelChargeLinks.tenantId, tenantId));
    await db.delete(hostelLeavePassApprovals).where(eq(hostelLeavePassApprovals.tenantId, tenantId));
    await db.delete(hostelLeavePassReturns).where(eq(hostelLeavePassReturns.tenantId, tenantId));
    await db.delete(hostelLeavePasses).where(eq(hostelLeavePasses.tenantId, tenantId));
    await db.delete(hostelAllocationEvents).where(eq(hostelAllocationEvents.tenantId, tenantId));
    await db.delete(hostelAllocations).where(eq(hostelAllocations.tenantId, tenantId));
    await db.delete(hostelApplications).where(eq(hostelApplications.tenantId, tenantId));
    await db.delete(hostelBeds).where(eq(hostelBeds.tenantId, tenantId));
    await db.delete(hostelRooms).where(eq(hostelRooms.tenantId, tenantId));
    await db.delete(hostelRoomCategories).where(eq(hostelRoomCategories.tenantId, tenantId));
    await db.delete(hostelZones).where(eq(hostelZones.tenantId, tenantId));
    await db.delete(hostels).where(eq(hostels.tenantId, tenantId));
    await db.delete(hostelPolicies).where(eq(hostelPolicies.tenantId, tenantId));
    await db.delete(invoiceItems).where(eq(invoiceItems.tenantId, tenantId));
    await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await db.delete(namingSeries).where(eq(namingSeries.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }

  beforeAll(async () => {
    const a = await seedTenant(tenantAId, adminAId);
    const b = await seedTenant(tenantBId, adminBId);
    hostelAId = a.hostelId;
    roomAId = a.roomId;
    categoryAId = a.categoryId;
    hostelBId = b.hostelId;
    foreignRoomId = b.roomId;
    // tenant A: three beds in two rooms (roomA + a second room)
    const roomB = await db.insert(hostelRooms).values({
      tenantId: tenantAId, hostelId: hostelAId, categoryId: categoryAId,
      code: `R2-${tenantAId.slice(0, 4)}`, name: 'Chambre 2', status: 'active',
    }).returning({ id: hostelRooms.id });
    roomCId = roomB[0]!.id;
    bedA1 = await addBed(tenantAId, roomAId, 'L1');
    bedB1 = await addBed(tenantAId, roomCId, 'L1');
    bedC1 = await addBed(tenantAId, roomCId, 'L2');
    await seedStudent(tenantAId, studentAId);
    await seedStudent(tenantAId, studentBId);
  });

  afterAll(async () => {
    await cleanupTenant(tenantAId);
    await cleanupTenant(tenantBId);
  });

  beforeEach(async () => {
    await clearAllocations(tenantAId);
    await clearAllocations(tenantBId);
  });

  describe('1. Transfer self-overlap no longer blocks its own transfer', () => {
    it('transfers a checked-in student to a free bed (previously always 409)', async () => {
      const { id: sourceId } = await makeCheckedInAllocation(tenantAId, studentAId, bedA1);
      const result = await transferAllocation(tenantAId, adminAId, sourceId, {
        targetBedId: bedB1, effectiveDate: today, reason: 'Test transfert',
      });

      expect(result.source.state).toBe('checked_out');
      // Same-day transfer closes the source at start+1 so `end > start` (CHECK)
      // holds; the bed was occupied by the departing student only for that day.
      expect(result.source.effectiveEndDate).toBe(addDays(today, 1));
      expect(result.destination.state).toBe('checked_in');
      expect(result.destination.bedId).toBe(bedB1);
      expect(result.destination.sourceAllocationId).toBe(sourceId);

      const sourceEvents = await listAllocationEvents(tenantAId, sourceId, true);
      const destEvents = await listAllocationEvents(tenantAId, result.destination.id, true);
      expect(sourceEvents.map(e => e.eventType)).toContain('transferred_out');
      expect(destEvents.map(e => e.eventType)).toContain('transferred_in');
    });

    it('rolls back atomically when the target bed is occupied — source unchanged', async () => {
      // Occupy the target bed first so the transfer must be rejected.
      await makeCheckedInAllocation(tenantAId, studentBId, bedB1);
      const { id: sourceId } = await makeCheckedInAllocation(tenantAId, studentAId, bedC1);
      const before = await db.select().from(hostelAllocations)
        .where(and(eq(hostelAllocations.id, sourceId), eq(hostelAllocations.tenantId, tenantAId))).limit(1);

      await expectApiError(
        transferAllocation(tenantAId, adminAId, sourceId, { targetBedId: bedB1, effectiveDate: today }),
        409, 'TRANSFER_BLOCKED',
      );

      const after = await db.select().from(hostelAllocations)
        .where(and(eq(hostelAllocations.id, sourceId), eq(hostelAllocations.tenantId, tenantAId))).limit(1);
      expect(after[0]!.state).toBe('checked_in');
      expect(after[0]!.bedId).toBe(bedC1);
      expect(after[0]!.effectiveStartDate).toBe(before[0]!.effectiveStartDate);
      expect(after[0]!.effectiveEndDate).toBe(before[0]!.effectiveEndDate);
    });
  });

  describe('2. Checkout idempotency + no duplicate Finance posting', () => {
    it('a second checkout of the same allocation is an idempotent no-op', async () => {
      const { id } = await makeCheckedInAllocation(tenantAId, studentAId, bedC1);
      const first = await checkOutAllocation(tenantAId, adminAId, id, { simulateFinanceFailure: true });
      expect(first.state).toBe('checked_out');

      const second = await checkOutAllocation(tenantAId, adminAId, id, { simulateFinanceFailure: true });
      expect(second.state).toBe('checked_out');
      expect(second.id).toBe(id);

      const events = await listAllocationEvents(tenantAId, id, true);
      expect(events.filter(e => e.eventType === 'checked_out')).toHaveLength(1);

      const links = await db.select({ id: hostelChargeLinks.id }).from(hostelChargeLinks)
        .where(eq(hostelChargeLinks.allocationId, id));
      expect(links).toHaveLength(1);
    });

    it('two concurrent checkouts produce exactly one checked_out event and one charge link', async () => {
      const { id } = await makeCheckedInAllocation(tenantAId, studentBId, bedA1);
      const results = await Promise.allSettled([
        checkOutAllocation(tenantAId, adminAId, id, { simulateFinanceFailure: true }),
        checkOutAllocation(tenantAId, adminAId, id, { simulateFinanceFailure: true }),
      ]);
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);

      const events = await listAllocationEvents(tenantAId, id, true);
      expect(events.filter(e => e.eventType === 'checked_out')).toHaveLength(1);

      const links = await db.select({ id: hostelChargeLinks.id }).from(hostelChargeLinks)
        .where(eq(hostelChargeLinks.allocationId, id));
      expect(links).toHaveLength(1);
    });
  });

  describe('3. Bulk commit rejects cross-tenant students', () => {
    it('does not allocate a tenant-B student on a tenant-A bed', async () => {
      const bedA2 = await addBed(tenantAId, roomAId, `L2-${suffix}`);
      const foreignStudent = `HST-STU-FOREIGN-${suffix}`;
      await seedStudent(tenantBId, foreignStudent);

      await expectApiError(
        bulkCommitAllocations(tenantAId, adminAId, [{
          studentId: foreignStudent, bedId: bedA2,
          effectiveStartDate: today, effectiveEndDate: endDate,
        }]),
        422, 'STUDENT_NOT_FOUND',
      );

      const rows = await db.select({ id: hostelAllocations.id }).from(hostelAllocations)
        .where(and(eq(hostelAllocations.bedId, bedA2), eq(hostelAllocations.tenantId, tenantAId)));
      expect(rows).toHaveLength(0);
    });
  });

  describe('4. Application/student binding + date-window validation', () => {
    it('rejects committing an application against a different student', async () => {
      const app = await createApplication(tenantAId, adminAId, {
        studentId: studentAId,
        requestedStartDate: today, requestedEndDate: endDate,
      });
      await decideApplication(tenantAId, app.id, adminAId, { decision: 'approved' });

      const bed = await addBed(tenantAId, roomAId, `LB-${suffix}`);
      await expectApiError(
        commitAllocation(tenantAId, adminAId, {
          applicationId: app.id, studentId: studentBId, bedId: bed,
          effectiveStartDate: today, effectiveEndDate: endDate,
        }),
        422, 'APPLICATION_STUDENT_MISMATCH',
      );
    });

    it('rejects an allocation period outside the approved application window', async () => {
      const app = await createApplication(tenantAId, adminAId, {
        studentId: studentAId,
        requestedStartDate: today, requestedEndDate: addDays(today, 30),
      });
      await decideApplication(tenantAId, app.id, adminAId, { decision: 'approved' });

      const bed = await addBed(tenantAId, roomAId, `LW-${suffix}`);
      await expectApiError(
        commitAllocation(tenantAId, adminAId, {
          applicationId: app.id, studentId: studentAId, bedId: bed,
          effectiveStartDate: today, effectiveEndDate: addDays(today, 60),
        }),
        422, 'APPLICATION_DATE_MISMATCH',
      );
    });
  });

  describe('6. Same-day checkout keeps end > start (CHECK constraint)', () => {
    it('checking out the day the stay starts computes a valid end date', async () => {
      const allocated = await commitAllocation(tenantAId, adminAId, {
        studentId: studentAId, bedId: bedA1, effectiveStartDate: today, effectiveEndDate: endDate,
      });
      await checkInAllocation(tenantAId, adminAId, allocated.id);
      const row = await checkOutAllocation(tenantAId, adminAId, allocated.id, { simulateFinanceFailure: true });
      expect(row.state).toBe('checked_out');
      expect(row.effectiveEndDate > row.effectiveStartDate).toBe(true);
      expect(row.effectiveEndDate).toBe(addDays(today, 1));
    });
  });

  describe('7. Application foreign-reference tenant validation', () => {
    it('rejects a sessionYearId that does not belong to the tenant', async () => {
      await expectApiError(
        createApplication(tenantAId, adminAId, {
          studentId: studentAId, sessionYearId: crypto.randomUUID(),
          requestedStartDate: today, requestedEndDate: endDate,
        }),
        422, 'INVALID_SESSION_YEAR',
      );
    });

    it('rejects a preferredRoomId from another tenant', async () => {
      await expectApiError(
        createApplication(tenantAId, adminAId, {
          studentId: studentAId, preferredRoomId: foreignRoomId,
          requestedStartDate: today, requestedEndDate: endDate,
        }),
        422, 'INVALID_ROOM',
      );
    });

    it('rejects a preferredCategoryId from another tenant', async () => {
      const foreignCategory = await db.insert(hostelRoomCategories).values({
        tenantId: tenantBId, name: 'Foreign', code: `FOR-${suffix}`,
        baseCharge: '1.00', depositAmount: '0', status: 'active',
      }).returning({ id: hostelRoomCategories.id });
      await expectApiError(
        createApplication(tenantAId, adminAId, {
          studentId: studentAId, preferredCategoryIds: [foreignCategory[0]!.id],
          requestedStartDate: today, requestedEndDate: endDate,
        }),
        422, 'INVALID_CATEGORY',
      );
    });
  });

  describe('8. Self-service leave-pass allowlist', () => {
    it('never exposes reason or createdById to resident/guardian projections', async () => {
      const { id } = await makeCheckedInAllocation(tenantAId, studentAId, bedB1);
      const pass = await createLeavePass(tenantAId, adminAId, {
        allocationId: id,
        destination: 'Casa',
        reason: 'Week-end famille',
        startDateTime: new Date().toISOString(),
        expectedReturnAt: new Date(Date.now() + 4 * 3_600_000).toISOString(),
      });

      const self = await listLeavePassesForSelf(tenantAId, id);
      const mine = self.find(p => p.id === pass.id);
      expect(mine).toBeDefined();
      expect(mine!.destination).toBe('Casa');
      expect('reason' in mine!).toBe(false);
      expect('createdById' in mine!).toBe(false);
    });
  });

  describe('9. Invoice numbers are unique under concurrency (tenant-scoped)', () => {
    it('two concurrent emitCharge calls yield distinct invoice numbers', async () => {
      const a1 = await makeCheckedInAllocation(tenantAId, studentAId, bedA1);
      const a2 = await makeCheckedInAllocation(tenantAId, studentBId, bedB1);

      const [r1, r2] = await Promise.all([
        emitCharge(tenantAId, { allocationId: a1.id, studentId: studentAId, chargeType: 'residence_fee', amount: '1800', description: 'test' }),
        emitCharge(tenantAId, { allocationId: a2.id, studentId: studentBId, chargeType: 'residence_fee', amount: '1800', description: 'test' }),
      ]);

      expect(r1.invoiceId).not.toBe(r2.invoiceId);
      // emitCharge returns invoiceId; the numbers live on the invoice rows.
      const invRows = await db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber }).from(invoices)
        .where(and(eq(invoices.tenantId, tenantAId), inArray(invoices.id, [r1.invoiceId, r2.invoiceId])));
      expect(invRows).toHaveLength(2);
      expect(new Set(invRows.map(r => r.invoiceNumber)).size).toBe(2);
    }, 20000);
  });

  describe('10. Leave approval race — row lock serializes concurrent decisions', () => {
    it('exactly one approval row and a single final state', async () => {
      const { id } = await makeCheckedInAllocation(tenantAId, studentAId, bedC1);
      const pass = await createLeavePass(tenantAId, adminAId, {
        allocationId: id,
        destination: 'Rabat',
        reason: 'Visite familiale',
        startDateTime: new Date().toISOString(),
        expectedReturnAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      });

      const results = await Promise.allSettled([
        decideLeavePass(tenantAId, adminAId, pass.id, { decision: 'approved', approverRole: 'warden' }),
        decideLeavePass(tenantAId, adminAId, pass.id, { decision: 'approved', approverRole: 'warden' }),
      ]);

      const successes = results.filter(r => r.status === 'fulfilled');
      const rejections = results.filter(r => r.status === 'rejected');
      expect(successes).toHaveLength(1);
      expect(rejections).toHaveLength(1);
      expect((rejections[0] as PromiseRejectedResult).reason).toBeInstanceOf(ApiError);
      expect(((rejections[0] as PromiseRejectedResult).reason as ApiError).code).toBe('ALREADY_DECIDED');

      const approvals = await db.select({ id: hostelLeavePassApprovals.id }).from(hostelLeavePassApprovals)
        .where(eq(hostelLeavePassApprovals.leavePassId, pass.id));
      expect(approvals).toHaveLength(1);

      const finalPass = await db.select({ status: hostelLeavePasses.status }).from(hostelLeavePasses)
        .where(eq(hostelLeavePasses.id, pass.id)).limit(1);
      expect(finalPass[0]!.status).toBe('approved');
    }, 20000);
  });

  describe('5. Lifecycle idempotency (atomic conditional claims)', () => {
    it('double check-in is idempotent', async () => {
      const allocated = await commitAllocation(tenantAId, adminAId, {
        studentId: studentBId, bedId: bedA1, effectiveStartDate: today, effectiveEndDate: endDate,
      });
      const first = await checkInAllocation(tenantAId, adminAId, allocated.id);
      expect(first.state).toBe('checked_in');
      const second = await checkInAllocation(tenantAId, adminAId, allocated.id);
      expect(second.state).toBe('checked_in');
      const events = await listAllocationEvents(tenantAId, allocated.id, true);
      expect(events.filter(e => e.eventType === 'checked_in')).toHaveLength(1);
    });

    it('double cancel of a reservation is idempotent', async () => {
      const allocated = await commitAllocation(tenantAId, adminAId, {
        studentId: studentAId, bedId: bedC1, effectiveStartDate: today, effectiveEndDate: endDate,
      });
      const first = await cancelAllocation(tenantAId, adminAId, allocated.id, 'retrait');
      expect(first.state).toBe('cancelled');
      const second = await cancelAllocation(tenantAId, adminAId, allocated.id);
      expect(second.state).toBe('cancelled');
    });
  });
});
