import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { branches, libraryCharges, libraryCopies, libraryHoldEvents, libraryHolds, libraryLoanPolicies, libraryLoans, tenants, user } from '@/models/Schema';
import { createCatalogRecord, createCopy, createEdition, createMember, issueCopy, listActiveLoans, listCatalog, renewLoan, returnLoan } from './library-service';
import { applyStocktakeAdjustments, cancelHold, closeStocktake, createTransfer, listStocktakeAdjustments, observeCopy, placeHold, startStocktake, transitionTransfer, waiveCharge } from './library-operations-service';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('library operational core', () => {
  const suffix = randomUUID().slice(0, 8);
  let tenantId = '';
  let branchId = '';
  let secondBranchId = '';
  let adminId = '';
  let memberId = '';
  let copyId = '';

  beforeAll(async () => {
    const [tenant] = await db.insert(tenants).values({ name: `Library Test ${suffix}`, slug: `library-test-${suffix}` }).returning();
    tenantId = tenant!.id;
    const [branch] = await db.insert(branches).values({ tenantId, name: 'Main', code: `L${suffix}` }).returning();
    branchId = branch!.id;
    const [secondBranch] = await db.insert(branches).values({ tenantId, name: 'Annex', code: `A${suffix}` }).returning();
    secondBranchId = secondBranch!.id;
    adminId = `lib-admin-${suffix}`;
    const studentId = `lib-student-${suffix}`;
    await db.insert(user).values([
      { id: adminId, tenantId, branchId, email: `${adminId}@test.local`, name: 'Library Admin', role: 'school_admin' },
      { id: studentId, tenantId, branchId, email: `${studentId}@test.local`, name: 'Library Student', role: 'student' },
    ]);
    await db.insert(libraryLoanPolicies).values({ tenantId, name: 'Student default', patronCategory: 'student', branchId, maxLoans: 2, loanDurationDays: 14, renewalLimit: 1, renewalDurationDays: 7, finePerDay: '1', gracePeriodDays: 0, maxHolds: 2 });
    const record = await createCatalogRecord(tenantId, { title: 'Test Driven Library' });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${Date.now().toString().slice(-10)}` });
    const copy = await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `ACC-${suffix}`, barcode: `BAR-${suffix}` });
    copyId = copy.id;
    const member = await createMember(tenantId, { userId: studentId, memberNumber: `MEM-${suffix}`, branchId });
    memberId = member.id;
  }, 30_000);

  afterAll(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('returns real tenant-scoped catalog inventory', async () => {
    const catalog = await listCatalog(tenantId, 'Test Driven');
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.editions[0]?.copies).toMatchObject({ total: 1, available: 1 });
  });

  it('issues, renews, and idempotently returns a copy', async () => {
    const loan = await issueCopy(tenantId, adminId, { copyId, memberId });
    expect(loan.memberId).toBe(memberId);
    const [checkedOut] = await db.select({ state: libraryCopies.state }).from(libraryCopies).where(and(eq(libraryCopies.id, copyId), eq(libraryCopies.tenantId, tenantId)));
    expect(checkedOut?.state).toBe('checked_out');

    const renewed = await renewLoan(tenantId, adminId, loan.id);
    expect(renewed.renewedCount).toBe(1);

    const returned = await returnLoan(tenantId, adminId, { loanId: loan.id, condition: 'good' });
    const retry = await returnLoan(tenantId, adminId, { loanId: loan.id, condition: 'good' });
    expect(retry.returnedAt).toBe(returned.returnedAt);
    const [available] = await db.select({ state: libraryCopies.state }).from(libraryCopies).where(eq(libraryCopies.id, copyId));
    expect(available?.state).toBe('available');
  });

  it('rejects cross-tenant circulation references', async () => {
    await expect(issueCopy(randomUUID(), adminId, { copyId, memberId })).rejects.toMatchObject({ code: 'INVALID_MEMBER' });
    const rows = await db.select().from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.copyId, copyId)));
    expect(rows).toHaveLength(1);
  });

  it('runs hold, transfer, stocktake, and charge lifecycle with tenant ownership', async () => {
    const hold = await placeHold(tenantId, adminId, copyId, memberId);
    const cancelled = await cancelHold(tenantId, adminId, hold.id, 'Plus nécessaire');
    expect(cancelled.state).toBe('cancelled');

    const transfer = await createTransfer(tenantId, adminId, { copyId, toBranchId: secondBranchId });
    expect((await transitionTransfer(tenantId, adminId, transfer.id, 'dispatch')).state).toBe('dispatched');
    expect((await transitionTransfer(tenantId, adminId, transfer.id, 'receive')).state).toBe('received');
    const [moved] = await db.select({ branchId: libraryCopies.branchId, state: libraryCopies.state }).from(libraryCopies).where(eq(libraryCopies.id, copyId));
    expect(moved).toMatchObject({ branchId: secondBranchId, state: 'available' });

    const stocktake = await startStocktake(tenantId, adminId, secondBranchId);
    expect((await observeCopy(tenantId, adminId, stocktake.id, copyId, true)).found).toBe(true);
    expect((await closeStocktake(tenantId, adminId, stocktake.id)).state).toBe('closed');

    const [charge] = await db.insert(libraryCharges).values({ tenantId, memberId, amount: '10', reason: 'damage', dedupeKey: `test-${suffix}` }).returning();
    expect((await waiveCharge(tenantId, adminId, charge!.id, 'Décision administrative')).state).toBe('waived');
  });

  it('reconciles stocktake to missing, dedupes checkout, and allocates the next hold on return', async () => {
    // Stocktake reconcile: an available copy counted as missing becomes a pending
    // adjustment that an approver applies to 'missing' — never auto-applied.
    await db.update(libraryCopies).set({ branchId: secondBranchId, state: 'available' }).where(and(eq(libraryCopies.id, copyId), eq(libraryCopies.tenantId, tenantId)));
    const st = await startStocktake(tenantId, adminId, secondBranchId);
    expect((await observeCopy(tenantId, adminId, st.id, copyId, false)).found).toBe(false);
    expect((await closeStocktake(tenantId, adminId, st.id)).state).toBe('closed');
    const adjustments = await listStocktakeAdjustments(tenantId, st.id);
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]).toMatchObject({ toState: 'missing' });
    expect(adjustments[0]?.appliedAt).toBeNull();
    await applyStocktakeAdjustments(tenantId, adminId, st.id);
    const [afterApply] = await db.select({ state: libraryCopies.state }).from(libraryCopies).where(and(eq(libraryCopies.id, copyId), eq(libraryCopies.tenantId, tenantId)));
    expect(afterApply?.state).toBe('missing');
    // A second apply is a no-op: the partial unique on unapplied adjustments
    // prevents the same copy being adjusted twice in one stocktake.
    await expect(applyStocktakeAdjustments(tenantId, adminId, st.id)).resolves.toHaveLength(0);

    // Idempotent checkout: the same idempotency key returns the existing loan.
    await db.update(libraryCopies).set({ branchId, state: 'available' }).where(and(eq(libraryCopies.id, copyId), eq(libraryCopies.tenantId, tenantId)));
    const key = `it-${suffix}`;
    const loan = await issueCopy(tenantId, adminId, { copyId, memberId, idempotencyKey: key });
    expect((await issueCopy(tenantId, adminId, { copyId, memberId, idempotencyKey: key })).id).toBe(loan.id);

    // Return allocates the FIFO hold: the copy waits on the hold shelf, a
    // 'notified' event is recorded, and issuing to the waiting member fulfills.
    const hold = await placeHold(tenantId, adminId, copyId, memberId);
    await returnLoan(tenantId, adminId, { loanId: loan.id, condition: 'good' });
    const [onShelf] = await db.select({ state: libraryCopies.state }).from(libraryCopies).where(and(eq(libraryCopies.id, copyId), eq(libraryCopies.tenantId, tenantId)));
    expect(onShelf?.state).toBe('on_hold_shelf');
    const holdEvents = await db.select({ eventType: libraryHoldEvents.eventType }).from(libraryHoldEvents).where(eq(libraryHoldEvents.holdId, hold.id));
    expect(holdEvents.map(e => e.eventType)).toContain('notified');
    await issueCopy(tenantId, adminId, { copyId, memberId });
    const [fulfilled] = await db.select({ state: libraryHolds.state }).from(libraryHolds).where(eq(libraryHolds.id, hold.id));
    expect(fulfilled?.state).toBe('fulfilled');
  });

  it('lists active loans tenant-scoped for the desk', async () => {
    const record = await createCatalogRecord(tenantId, { title: 'Active Loan Book' });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    const copy = await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `ACCAL-${suffix}`, barcode: `BARAL-${suffix}` });
    const loan = await issueCopy(tenantId, adminId, { copyId: copy.id, memberId });
    const active = await listActiveLoans(tenantId);
    expect(active.map(l => l.loanId)).toContain(loan.id);
    expect(active[0]).toMatchObject({ title: 'Active Loan Book', memberNumber: `MEM-${suffix}` });
    // Cross-tenant isolation: a foreign tenant sees no loans.
    expect(await listActiveLoans(randomUUID())).toHaveLength(0);
    await returnLoan(tenantId, adminId, { loanId: loan.id, condition: 'good' });
  });
});
