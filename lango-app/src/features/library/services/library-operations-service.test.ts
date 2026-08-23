import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { branches, libraryCharges, libraryCopies, libraryLoanPolicies, tenants, user } from '@/models/Schema';
import { createCatalogRecord, createCopy, createEdition, createMember, getMemberDetail, issueCopy, renewLoan, returnLoan } from './library-service';
import { cancelHold, circulationReport, inventoryReport, placeHold, waiveCharge } from './library-operations-service';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('library reporting & member detail', () => {
  const suffix = randomUUID().slice(0, 8);
  let tenantId = '';
  let branchId = '';
  let adminId = '';
  let memberId = '';
  let isbnCounter = 0;

  beforeAll(async () => {
    const [tenant] = await db.insert(tenants).values({ name: `Library Rpt ${suffix}`, slug: `library-rpt-${suffix}` }).returning();
    tenantId = tenant!.id;
    const [branch] = await db.insert(branches).values({ tenantId, name: 'Main', code: `R${suffix}` }).returning();
    branchId = branch!.id;
    adminId = `lib-rpt-admin-${suffix}`;
    const studentId = `lib-rpt-student-${suffix}`;
    await db.insert(user).values([
      { id: adminId, tenantId, branchId, email: `${adminId}@test.local`, name: 'Report Admin', role: 'school_admin' },
      { id: studentId, tenantId, branchId, email: `${studentId}@test.local`, name: 'Report Student', role: 'student' },
    ]);
    await db.insert(libraryLoanPolicies).values({ tenantId, name: 'Student default', patronCategory: 'student', branchId, maxLoans: 2, loanDurationDays: 14, renewalLimit: 1, renewalDurationDays: 7, finePerDay: '1', gracePeriodDays: 0, maxHolds: 2 });
    const member = await createMember(tenantId, { userId: studentId, memberNumber: `RMEM-${suffix}`, branchId });
    memberId = member.id;
  }, 30_000);

  afterAll(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  // Each test provisions its own copy so reports/member-detail assertions are
  // absolute rather than deltas against earlier tests' side effects.
  async function makeCopy(prefix: string) {
    const record = await createCatalogRecord(tenantId, { title: `Report ${prefix} Book` });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    const copy = await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `RPT-${prefix}-${suffix}`, barcode: `RPTB-${prefix}-${suffix}` });
    return copy.id;
  }

  it('inventoryReport pivots real copy states and conditions per branch', async () => {
    const copyId = await makeCopy('INV');

    let inv = await inventoryReport(tenantId);
    expect(inv.byBranch).toHaveLength(1);
    expect(inv.byBranch[0]).toMatchObject({ branchName: 'Main', total: 1, available: 1, checkedOut: 0, withdrawn: 0, active: 1 });
    expect(inv.byBranch[0]!.conditions.good).toBe(1);
    expect(inv.totals).toEqual({ total: 1, active: 1, withdrawn: 0 });

    // Issuing moves the copy out of available; active still counts it.
    const loan = await issueCopy(tenantId, adminId, { copyId, memberId });
    inv = await inventoryReport(tenantId);
    expect(inv.byBranch[0]).toMatchObject({ available: 0, checkedOut: 1, active: 1 });

    // Return, then withdraw: withdrawn is excluded from active.
    await returnLoan(tenantId, adminId, { loanId: loan.id, condition: 'good' });
    await db.update(libraryCopies).set({ state: 'withdrawn' }).where(and(eq(libraryCopies.id, copyId), eq(libraryCopies.tenantId, tenantId)));
    inv = await inventoryReport(tenantId);
    expect(inv.byBranch[0]).toMatchObject({ total: 1, withdrawn: 1, active: 0 });
    expect(inv.totals).toEqual({ total: 1, active: 0, withdrawn: 1 });

    // A foreign tenant sees no branches or copies.
    expect((await inventoryReport(randomUUID())).totals).toEqual({ total: 0, active: 0, withdrawn: 0 });
  });

  it('circulationReport aggregates real loan/hold/charge activity and is tenant-scoped', async () => {
    // The report is tenant-wide, so earlier tests' loans/charges already count;
    // capture the baseline and assert the delta introduced by this test.
    const before = await circulationReport(tenantId);

    const copyId = await makeCopy('CIRC');
    const loan = await issueCopy(tenantId, adminId, { copyId, memberId });
    await renewLoan(tenantId, adminId, loan.id);
    const hold = await placeHold(tenantId, adminId, copyId, memberId);
    const [charge] = await db.insert(libraryCharges).values({ tenantId, memberId, amount: '12.50', reason: 'damage', dedupeKey: `rpt-${suffix}` }).returning();

    const rep = await circulationReport(tenantId);
    expect(rep.loans.active).toBe(before.loans.active + 1);
    expect(rep.loans.issued30).toBe(before.loans.issued30 + 1);
    expect(rep.loans.renewed30).toBe(before.loans.renewed30 + 1);
    expect(rep.loans.issued90).toBe(before.loans.issued90 + 1);
    expect(rep.loans.renewed90).toBe(before.loans.renewed90 + 1);
    expect(rep.holds.waiting).toBe(before.holds.waiting + 1);
    expect(rep.charges.open).toBe(before.charges.open + 1);
    expect(rep.charges.openAmount).toBeCloseTo(before.charges.openAmount + 12.5);

    await returnLoan(tenantId, adminId, { loanId: loan.id, condition: 'good' });
    const rep2 = await circulationReport(tenantId);
    expect(rep2.loans.active).toBe(before.loans.active);
    expect(rep2.loans.returned30).toBe(before.loans.returned30 + 1);
    expect(hold.state).toBe('waiting');
    // The 30-day series is gap-filled: 30 buckets whose columns sum to the
    // aggregate counts.
    expect(rep2.loans.daily).toHaveLength(30);
    expect(rep2.loans.daily.reduce((sum, d) => sum + d.issued, 0)).toBe(rep2.loans.issued30);
    expect(rep2.loans.daily.reduce((sum, d) => sum + d.returned, 0)).toBe(rep2.loans.returned30);

    // A foreign tenant sees zeroed aggregates.
    const foreign = await circulationReport(randomUUID());
    expect(foreign.loans.active).toBe(0);
    expect(foreign.holds.waiting).toBe(0);
    expect(foreign.charges.open).toBe(0);

    // Clean up this test's hold/charge so the member-detail test's nested
    // arrays start empty (waiting holds and open charges are member-scoped).
    await cancelHold(tenantId, adminId, hold.id, 'Cleanup');
    await waiveCharge(tenantId, adminId, charge!.id, 'Cleanup');
  });

  it('getMemberDetail returns member with branch and populated nested arrays; foreign tenant 404s', async () => {
    const copyId = await makeCopy('DETAIL');
    const loan = await issueCopy(tenantId, adminId, { copyId, memberId });
    await db.insert(libraryCharges).values({ tenantId, memberId, amount: '5', reason: 'lost_copy', dedupeKey: `md-${suffix}` });
    await placeHold(tenantId, adminId, copyId, memberId);

    const detail = await getMemberDetail(tenantId, memberId);
    expect(detail.branchName).toBe('Main');
    expect(detail.name).toBe('Report Student');
    expect(detail.activeLoans).toHaveLength(1);
    expect(detail.activeLoans[0]).toMatchObject({ title: 'Report DETAIL Book' });
    expect(detail.openCharges).toHaveLength(1);
    expect(Number(detail.openCharges[0]!.amount)).toBe(5);
    expect(detail.waitingHolds).toHaveLength(1);

    // Cross-tenant isolation: an unknown tenant 404s rather than leaking data.
    await expect(getMemberDetail(randomUUID(), memberId)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await returnLoan(tenantId, adminId, { loanId: loan.id, condition: 'good' });
  });
});
