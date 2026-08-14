import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { branches, libraryBibliographicRecords, libraryCopies, libraryLoanPolicies, tenants, user } from '@/models/Schema';
import { createCatalogRecord, createCopy, createEdition, createMember, issueCopy } from './library-service';
import {
  createCategory, createContributor, createPublisher, createSubject, deleteCatalogRecord, deleteCopy, deleteEdition,
  getCatalogRecord, listCatalogPage, listCopies, setRecordContributors, setRecordSubjects, updateCatalogRecord,
  updateCopy, updateEdition,
} from './library-catalog-service';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('library catalog management', () => {
  const suffix = randomUUID().slice(0, 8);
  let tenantId = '';
  let branchId = '';
  let secondBranchId = '';
  let adminId = '';
  let memberId = '';

  beforeAll(async () => {
    const [tenant] = await db.insert(tenants).values({ name: `Catalog Test ${suffix}`, slug: `catalog-test-${suffix}` }).returning();
    tenantId = tenant!.id;
    const [branch] = await db.insert(branches).values({ tenantId, name: 'Main', code: `CT${suffix}` }).returning();
    branchId = branch!.id;
    const [secondBranch] = await db.insert(branches).values({ tenantId, name: 'Annex', code: `CA${suffix}` }).returning();
    secondBranchId = secondBranch!.id;
    adminId = `cat-admin-${suffix}`;
    const studentId = `cat-student-${suffix}`;
    await db.insert(user).values([
      { id: adminId, tenantId, branchId, email: `${adminId}@test.local`, name: 'Catalog Admin', role: 'school_admin' },
      { id: studentId, tenantId, branchId, email: `${studentId}@test.local`, name: 'Catalog Student', role: 'student' },
    ]);
    await db.insert(libraryLoanPolicies).values({ tenantId, name: 'Catalog default', patronCategory: 'student', branchId, maxLoans: 2, loanDurationDays: 14, renewalLimit: 1, renewalDurationDays: 7, finePerDay: '1', gracePeriodDays: 0, maxHolds: 2 });
    const member = await createMember(tenantId, { userId: studentId, memberNumber: `CAT-${suffix}`, branchId });
    memberId = member.id;
  }, 30_000);

  afterAll(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('paginates the catalog with stable sort and query filter', async () => {
    await createCatalogRecord(tenantId, { title: 'Omega Book' });
    await createCatalogRecord(tenantId, { title: 'Alpha Book' });
    const page = await listCatalogPage(tenantId, { query: 'Book', sortBy: 'title', limit: 1, offset: 0 });
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.title).toBe('Alpha Book');
    const second = await listCatalogPage(tenantId, { query: 'Book', sortBy: 'title', limit: 1, offset: 1 });
    expect(second.items[0]?.title).toBe('Omega Book');
  });

  it('returns record detail with editions, copies, contributors, and subjects', async () => {
    const record = await createCatalogRecord(tenantId, { title: 'Detail Book' });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${Date.now().toString().slice(-10)}` });
    await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `ACCD-${suffix}`, barcode: `BARCD-${suffix}` });
    const author = await createContributor(tenantId, { name: 'Ada Lovelace', primaryRole: 'author' });
    const subject = await createSubject(tenantId, { name: 'Programming' });
    await setRecordContributors(tenantId, record.id, [{ contributorId: author.id, role: 'author', sortOrder: 0 }]);
    await setRecordSubjects(tenantId, record.id, [subject.id]);

    const detail = await getCatalogRecord(tenantId, record.id);
    expect(detail.editions).toHaveLength(1);
    expect(detail.editions[0]?.copies).toHaveLength(1);
    expect(detail.contributors.map(c => c.name)).toContain('Ada Lovelace');
    expect(detail.subjects.map(s => s.name)).toContain('Programming');

    // Replace-style setters: clearing contributors leaves only subjects.
    await setRecordContributors(tenantId, record.id, []);
    const afterClear = await getCatalogRecord(tenantId, record.id);
    expect(afterClear.contributors).toHaveLength(0);
    expect(afterClear.subjects).toHaveLength(1);
  });

  it('rejects invalid taxonomy references and duplicate taxonomy names', async () => {
    await expect(createCategory(tenantId, { name: 'Orphan', parentId: randomUUID() })).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
    await createContributor(tenantId, { name: 'Duplicate Author' });
    await expect(createContributor(tenantId, { name: 'Duplicate Author' })).rejects.toMatchObject({ code: 'DUPLICATE_CONTRIBUTOR' });
    await expect(createPublisher(tenantId, { name: 'X' })).resolves.toMatchObject({ name: 'X' });
    await expect(createPublisher(tenantId, { name: 'X' })).rejects.toMatchObject({ code: 'DUPLICATE_PUBLISHER' });
  });

  it('rejects duplicate ISBN on edition update and duplicate copy identifiers', async () => {
    const a = await createCatalogRecord(tenantId, { title: 'ISBN A' });
    const b = await createCatalogRecord(tenantId, { title: 'ISBN B' });
    const isbnA = `978${Date.now().toString().slice(-10)}`;
    const isbnB = `978${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const edA = await createEdition(tenantId, { recordId: a.id, isbn13: isbnA });
    await createEdition(tenantId, { recordId: b.id, isbn13: isbnB });
    // Updating edA to an ISBN already held by another edition must be rejected.
    await expect(updateEdition(tenantId, edA.id, { isbn13: isbnB })).rejects.toMatchObject({ code: 'DUPLICATE_ISBN' });

    const edB = await createEdition(tenantId, { recordId: a.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    await createCopy(tenantId, { editionId: edB.id, branchId, accessionNumber: `ACCX-${suffix}`, barcode: `BARX-${suffix}` });
    await expect(createCopy(tenantId, { editionId: edB.id, branchId, accessionNumber: `ACCX-${suffix}` })).rejects.toMatchObject({ code: 'DUPLICATE_COPY_IDENTIFIER' });
  });

  it('restricts copy re-homing and withdrawal by state', async () => {
    const record = await createCatalogRecord(tenantId, { title: 'Copy State Book' });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    const copy = await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `ACCS-${suffix}`, barcode: `BARS-${suffix}` });

    // Free copy: editable fields + direct branch reassign allowed.
    const updated = await updateCopy(tenantId, copy.id, { shelfLocation: 'Aisle 1', branchId });
    expect(updated.shelfLocation).toBe('Aisle 1');

    // Checked-out copy cannot be re-homed (only via a transfer) or withdrawn.
    const loan = await issueCopy(tenantId, adminId, { copyId: copy.id, memberId });
    expect(loan.memberId).toBe(memberId);
    await expect(updateCopy(tenantId, copy.id, { branchId: secondBranchId })).rejects.toMatchObject({ code: 'COPY_NOT_FREE' });
    await expect(deleteCopy(tenantId, copy.id)).rejects.toMatchObject({ code: 'COPY_NOT_WITHDRAWABLE' });

    // Record soft-delete blocked while a copy is in circulation.
    await expect(deleteCatalogRecord(tenantId, record.id)).rejects.toMatchObject({ code: 'RECORD_IN_CIRCULATION' });
  });

  it('soft-deletes a free record and withdraws a free copy, all tenant-scoped', async () => {
    const record = await createCatalogRecord(tenantId, { title: 'Removable Book' });
    const edition = await createEdition(tenantId, { recordId: record.id, isbn13: `978${randomUUID().replace(/-/g, '').slice(0, 10)}` });
    const copy = await createCopy(tenantId, { editionId: edition.id, branchId, accessionNumber: `ACCR-${suffix}`, barcode: `BARR-${suffix}` });

    const withdrawn = await deleteCopy(tenantId, copy.id);
    expect(withdrawn.state).toBe('withdrawn');
    expect(withdrawn.withdrawnAt).toBeTruthy();
    await expect(deleteEdition(tenantId, edition.id)).rejects.toMatchObject({ code: 'EDITION_IN_USE' });

    const deleted = await deleteCatalogRecord(tenantId, record.id);
    expect(deleted.deletedAt).toBeTruthy();
    const listed = await listCatalogPage(tenantId, { query: 'Removable' });
    expect(listed.total).toBe(0);

    // Other tenant sees none of this data.
    const otherTenant = randomUUID();
    expect((await listCatalogPage(otherTenant, { query: 'Removable' })).total).toBe(0);
    expect((await listCopies(otherTenant)).items).toHaveLength(0);
    const [copyState] = await db.select({ state: libraryCopies.state }).from(libraryCopies).where(and(eq(libraryCopies.id, copy.id), eq(libraryCopies.tenantId, tenantId)));
    expect(copyState?.state).toBe('withdrawn');
    const [recordRow] = await db.select({ deletedAt: libraryBibliographicRecords.deletedAt }).from(libraryBibliographicRecords).where(eq(libraryBibliographicRecords.id, record.id));
    expect(recordRow?.deletedAt).toBeTruthy();
  });

  it('keeps listCatalogPage stable after updating a record', async () => {
    const record = await createCatalogRecord(tenantId, { title: 'Update Me' });
    const updated = await updateCatalogRecord(tenantId, record.id, { title: 'Updated Me' });
    expect(updated.title).toBe('Updated Me');
    const listed = await listCatalogPage(tenantId, { query: 'Updated Me' });
    expect(listed.items[0]?.title).toBe('Updated Me');
  });
});
