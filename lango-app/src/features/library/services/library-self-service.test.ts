import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { branches, guardianStudents, guardians, libraryLoanPolicies, tenants, user } from '@/models/Schema';
import { createCatalogRecord, createCopy, createEdition, createMember, issueCopy, listChildLoans, listOwnCharges, listOwnHolds, listOwnLoans, ownLibraryHome, renewOwnLoan, returnLoan, listAccessibleChildren, cancelOwnHold } from './library-service';
import { placeHold } from './library-operations-service';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('library member self-service isolation', () => {
  const suffix = randomUUID().slice(0, 8);
  let tenantId = '';
  let branchId = '';
  let adminId = '';
  let studentAId = '';
  let studentBId = '';
  let parentId = '';
  let nonMemberId = '';
  let otherParentId = '';
  let memberAId = '';

  beforeAll(async () => {
    const [tenant] = await db.insert(tenants).values({ name: `Self Test ${suffix}`, slug: `self-test-${suffix}` }).returning();
    tenantId = tenant!.id;
    const [branch] = await db.insert(branches).values({ tenantId, name: 'Main', code: `SF${suffix}` }).returning();
    branchId = branch!.id;
    adminId = `self-admin-${suffix}`;
    studentAId = `self-a-${suffix}`;
    studentBId = `self-b-${suffix}`;
    parentId = `self-parent-${suffix}`;
    nonMemberId = `self-non-${suffix}`;
    otherParentId = `other-parent-${suffix}`;
    await db.insert(user).values([
      { id: adminId, tenantId, branchId, email: `${adminId}@test.local`, name: 'Self Admin', role: 'school_admin' },
      { id: studentAId, tenantId, branchId, email: `${studentAId}@test.local`, name: 'Student A', role: 'student' },
      { id: studentBId, tenantId, branchId, email: `${studentBId}@test.local`, name: 'Student B', role: 'student' },
      { id: parentId, tenantId, branchId, email: `${parentId}@test.local`, name: 'Parent One', role: 'parent' },
      { id: nonMemberId, tenantId, branchId, email: `${nonMemberId}@test.local`, name: 'Not a Member', role: 'student' },
      { id: otherParentId, tenantId, branchId, email: `${otherParentId}@test.local`, name: 'Other Parent', role: 'parent' },
    ]);
    await db.insert(libraryLoanPolicies).values({ tenantId, name: 'Self default', patronCategory: 'student', branchId, maxLoans: 3, loanDurationDays: 14, renewalLimit: 1, renewalDurationDays: 7, finePerDay: '1', gracePeriodDays: 0, maxHolds: 2 });
    const a = await createMember(tenantId, { userId: studentAId, memberNumber: `SFA-${suffix}`, branchId });
    memberAId = a.id;
    await createMember(tenantId, { userId: studentBId, memberNumber: `SFB-${suffix}`, branchId });
    const [guardian] = await db.insert(guardians).values({ tenantId, userId: parentId, firstName: 'Parent', lastName: 'One' }).returning();
    await db.insert(guardianStudents).values({ tenantId, guardianId: guardian!.id, studentId: studentAId, relationshipType: 'parent', canAccessLibrary: true });
    await db.insert(guardianStudents).values({ tenantId, guardianId: guardian!.id, studentId: studentBId, relationshipType: 'parent', canAccessLibrary: false });
  }, 30_000);

  afterAll(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('resolves own member from the session user, never a client member id', async () => {
    const home = await ownLibraryHome(tenantId, studentAId);
    expect(home.memberNumber).toBe(`SFA-${suffix}`);
    await expect(ownLibraryHome(tenantId, nonMemberId)).rejects.toMatchObject({ code: 'NOT_A_MEMBER' });
  });

  it('returns own loans and renews only own loans', async () => {
    const record = await createCatalogRecord(tenantId, { title: 'Self Book' });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    const copy = await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `ACCSF-${suffix}`, barcode: `BARSF-${suffix}` });
    const loan = await issueCopy(tenantId, adminId, { copyId: copy.id, memberId: memberAId });

    const own = await listOwnLoans(tenantId, studentAId);
    expect(own.map(l => l.id)).toContain(loan.id);

    // Self-renewal works for the owner…
    const renewed = await renewOwnLoan(tenantId, studentAId, loan.id);
    expect(renewed.renewedCount).toBe(1);

    // …and is denied for another member.
    await expect(renewOwnLoan(tenantId, studentBId, loan.id)).rejects.toMatchObject({ code: 'NOT_OWN_LOAN' });

    await returnLoan(tenantId, adminId, { loanId: loan.id, condition: 'good' });
    expect((await listOwnLoans(tenantId, studentAId)).map(l => l.id)).not.toContain(loan.id);
  });

  it('surfaces only the caller’s holds and charges', async () => {
    expect(await listOwnHolds(tenantId, studentAId)).toHaveLength(0);
    expect(await listOwnCharges(tenantId, studentAId)).toHaveLength(0);
    // A non-member has no holds/charges to see.
    await expect(listOwnHolds(tenantId, nonMemberId)).rejects.toMatchObject({ code: 'NOT_A_MEMBER' });
  });

  it('cancels only the caller’s own hold', async () => {
    const record = await createCatalogRecord(tenantId, { title: 'Hold Book' });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    const copy = await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `ACCHO-${suffix}`, barcode: `BARHO-${suffix}` });
    const hold = await placeHold(tenantId, adminId, copy.id, memberAId);
    const cancelled = await cancelOwnHold(tenantId, studentAId, hold.id, 'Plus nécessaire');
    expect(cancelled.state).toBe('cancelled');

    // Another member cannot cancel a hold they do not own.
    const hold2 = await placeHold(tenantId, adminId, copy.id, memberAId);
    await expect(cancelOwnHold(tenantId, studentBId, hold2.id, 'Test')).rejects.toMatchObject({ code: 'NOT_OWN_HOLD' });
  });

  it('grants a guardian child view only with active relationship + library right', async () => {
    const children = await listAccessibleChildren(tenantId, parentId);
    expect(children.map(c => c.studentId)).toContain(studentAId);
    expect(children.map(c => c.studentId)).not.toContain(studentBId);

    // Revoke the library right → the child disappears from the list.
    await db.update(guardianStudents).set({ canAccessLibrary: false }).where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, studentAId)));
    const after = await listAccessibleChildren(tenantId, parentId);
    expect(after.map(c => c.studentId)).not.toContain(studentAId);
    await expect(listChildLoans(tenantId, parentId, studentAId)).rejects.toMatchObject({ code: 'NO_GUARDIAN_LIBRARY_ACCESS' });

    // Re-grant for the loan assertion.
    await db.update(guardianStudents).set({ canAccessLibrary: true }).where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, studentAId)));

    const record = await createCatalogRecord(tenantId, { title: 'Child Book' });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    const copy = await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `ACCCH-${suffix}`, barcode: `BARCH-${suffix}` });
    const loan = await issueCopy(tenantId, adminId, { copyId: copy.id, memberId: memberAId });
    const childLoans = await listChildLoans(tenantId, parentId, studentAId);
    expect(childLoans.map(l => l.id)).toContain(loan.id);

    // A guardian whose relationship lacks the library right is denied.
    const [otherGuardian] = await db.insert(guardians).values({ tenantId, userId: otherParentId, firstName: 'Other', lastName: 'Guardian' }).returning();
    await db.insert(guardianStudents).values({ tenantId, guardianId: otherGuardian!.id, studentId: studentAId, relationshipType: 'parent', canAccessLibrary: false });
    await expect(listChildLoans(tenantId, otherParentId, studentAId)).rejects.toMatchObject({ code: 'NO_GUARDIAN_LIBRARY_ACCESS' });
  });
});
