import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { branches, tenants, user } from '@/models/Schema';
import { createCatalogRecord, createCopy, createEdition, createMember, issueCopy } from './library-service';
import { createClosureDay, createLoanPolicy, deleteClosureDay, deleteLoanPolicy, listClosureDays, listPolicies, updateLoanPolicy } from './library-operations-service';

const hasDb = Boolean(process.env.DATABASE_URL);

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDaysIso = (base: Date, days: number) => iso(new Date(new Date(base).setUTCDate(base.getUTCDate() + days)));

describe.skipIf(!hasDb)('library policy & closure management', () => {
  const suffix = randomUUID().slice(0, 8);
  let tenantId = '';
  let branchId = '';
  let secondBranchId = '';
  let adminId = '';
  let memberId = '';

  beforeAll(async () => {
    const [tenant] = await db.insert(tenants).values({ name: `Policy Test ${suffix}`, slug: `policy-test-${suffix}` }).returning();
    tenantId = tenant!.id;
    const [branch] = await db.insert(branches).values({ tenantId, name: 'Main', code: `PT${suffix}` }).returning();
    branchId = branch!.id;
    const [secondBranch] = await db.insert(branches).values({ tenantId, name: 'Annex', code: `PA${suffix}` }).returning();
    secondBranchId = secondBranch!.id;
    adminId = `pol-admin-${suffix}`;
    const studentId = `pol-student-${suffix}`;
    await db.insert(user).values([
      { id: adminId, tenantId, branchId, email: `${adminId}@test.local`, name: 'Policy Admin', role: 'school_admin' },
      { id: studentId, tenantId, branchId, email: `${studentId}@test.local`, name: 'Policy Student', role: 'student' },
    ]);
    const member = await createMember(tenantId, { userId: studentId, memberNumber: `POL-${suffix}`, branchId });
    memberId = member.id;
  }, 30_000);

  afterAll(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('creates, updates, deletes policies and rejects duplicates per branch', async () => {
    const generic = await createLoanPolicy(tenantId, { name: 'Generic student', patronCategory: 'student', maxLoans: 3, loanDurationDays: 14 });
    expect(generic.patronCategory).toBe('student');
    await expect(createLoanPolicy(tenantId, { name: 'Dup generic', patronCategory: 'student' })).rejects.toMatchObject({ code: 'DUPLICATE_POLICY' });

    const branchPolicy = await createLoanPolicy(tenantId, { name: 'Main student', patronCategory: 'student', branchId, loanDurationDays: 7 });
    expect(branchPolicy.branchId).toBe(branchId);
    await expect(createLoanPolicy(tenantId, { name: 'Dup branch', patronCategory: 'student', branchId })).rejects.toMatchObject({ code: 'DUPLICATE_POLICY' });

    // Same category at a different branch is allowed.
    const annexPolicy = await createLoanPolicy(tenantId, { name: 'Annex student', patronCategory: 'student', branchId: secondBranchId, loanDurationDays: 5 });
    expect(annexPolicy.branchId).toBe(secondBranchId);

    const updated = await updateLoanPolicy(tenantId, branchPolicy.id, { maxLoans: 5 });
    expect(updated.maxLoans).toBe(5);

    // Self-clean so the shared 'student' category is reusable by later tests.
    await deleteLoanPolicy(tenantId, generic.id);
    await deleteLoanPolicy(tenantId, branchPolicy.id);
    await deleteLoanPolicy(tenantId, annexPolicy.id);
    await expect(deleteLoanPolicy(tenantId, generic.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('resolves branch policy precedence over the generic policy', async () => {
    const generic = await createLoanPolicy(tenantId, { name: 'Generic 14d', patronCategory: 'student', loanDurationDays: 14 });
    const branchPolicy = await createLoanPolicy(tenantId, { name: 'Branch 7d', patronCategory: 'student', branchId, loanDurationDays: 7 });
    const record = await createCatalogRecord(tenantId, { title: 'Precedence Book' });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    const copy = await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `ACCP-${suffix}`, barcode: `BARP-${suffix}` });
    const loan = await issueCopy(tenantId, adminId, { copyId: copy.id, memberId });
    const snapshot = loan.policySnapshot as { loanDurationDays: number };
    expect(snapshot.loanDurationDays).toBe(7);
    await deleteLoanPolicy(tenantId, generic.id);
    await deleteLoanPolicy(tenantId, branchPolicy.id);
  });

  it('skips branch-scoped and tenant-wide closure days when computing due dates', async () => {
    const today = new Date();
    const closedDay = addDaysIso(today, 1);
    // Tenant-wide closure affects every branch.
    await createClosureDay(tenantId, { closedOn: closedDay, reason: 'Jour férié' });
    await expect(createClosureDay(tenantId, { closedOn: closedDay })).rejects.toMatchObject({ code: 'DUPLICATE_CLOSURE' });
    // A branch-scoped closure on a different day affects only that branch.
    const annexOnly = addDaysIso(today, 2);
    await createClosureDay(tenantId, { closedOn: annexOnly, branchId: secondBranchId, reason: 'Inventaire annexe' });

    const twoDay = await createLoanPolicy(tenantId, { name: '2-day', patronCategory: 'student', branchId, loanDurationDays: 2 });
    const record = await createCatalogRecord(tenantId, { title: 'Closure Book' });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    const copy = await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `ACCC-${suffix}`, barcode: `BARC-${suffix}` });

    // 2 open days from today, skipping the closed day => today+3.
    const loan = await issueCopy(tenantId, adminId, { copyId: copy.id, memberId });
    expect(loan.dueDate).toBe(addDaysIso(today, 3));

    // The annex-only closure must NOT affect the main branch copy.
    const otherRecord = await createCatalogRecord(tenantId, { title: 'Annex Closure Book' });
    const otherEdition = await createEdition(tenantId, { recordId: otherRecord.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    const annexCopy = await createCopy(tenantId, { editionId: otherEdition.id, branchId, accessionNumber: `ACCD-${suffix}`, barcode: `BARD-${suffix}` });
    const annexLoan = await issueCopy(tenantId, adminId, { copyId: annexCopy.id, memberId });
    expect(annexLoan.dueDate).toBe(addDaysIso(today, 3));

    // Closures can be listed with filters and deleted.
    const listed = await listClosureDays(tenantId, { from: closedDay });
    expect(listed.map(d => d.closedOn)).toContain(closedDay);
    const [annexClosure] = await listClosureDays(tenantId, { branchId: secondBranchId });
    expect(annexClosure?.closedOn).toBe(annexOnly);
    await deleteClosureDay(tenantId, annexClosure!.id);
    expect(await listClosureDays(tenantId, { branchId: secondBranchId })).toHaveLength(0);
    await deleteLoanPolicy(tenantId, twoDay.id);
  });

  it('isolates policies and closures across tenants', async () => {
    const otherTenant = randomUUID();
    expect(await listPolicies(otherTenant)).toHaveLength(0);
    expect(await listClosureDays(otherTenant)).toHaveLength(0);
    // The other tenant cannot reference this tenant's branch for a closure.
    await expect(createClosureDay(otherTenant, { closedOn: '2030-01-01', branchId })).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
    // The other tenant cannot reference this tenant's branch for a policy.
    await expect(createLoanPolicy(otherTenant, { name: 'X', patronCategory: 'student', branchId })).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
  });
});
