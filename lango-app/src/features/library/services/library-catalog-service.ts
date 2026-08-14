// Catalog management: taxonomy CRUD, record detail/update/soft-delete, edition
// and copy CRUD, paginated catalog listing. Every query is tenant-scoped and
// foreign ids are re-verified WHERE id=? AND tenantId=?.
import { and, asc, desc, eq, getTableColumns, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import {
  branches,
  libraryBibliographicRecords,
  libraryCategories,
  libraryContributors,
  libraryCopies,
  libraryEditions,
  libraryHolds,
  libraryMembers,
  libraryPublishers,
  libraryRecordContributors,
  libraryRecordSubjects,
  librarySubjects,
  user,
} from '@/models/Schema';

// Drizzle wraps pg errors in DrizzleQueryError; the SQLSTATE lives on `.cause`.
function pgErrorCode(error: unknown): string | undefined {
  for (const candidate of [error, (error as { cause?: unknown } | null)?.cause]) {
    if (candidate && typeof candidate === 'object' && 'code' in candidate && typeof (candidate as { code?: unknown }).code === 'string') {
      return (candidate as { code: string }).code;
    }
  }
  return undefined;
}

function assertUniqueViolation(error: unknown, code: string, message: string): void {
  if (pgErrorCode(error) === '23505') throw new ApiError(409, code, message);
}

// ---------------------------------------------------------------------------
// Paginated catalog listing (stable sort + server pagination)
// ---------------------------------------------------------------------------

export async function listCatalogPage(
  tenantId: string,
  input: { query?: string; sortBy?: 'title' | 'created' | 'updated'; offset?: number; limit?: number } = {},
) {
  const where = [eq(libraryBibliographicRecords.tenantId, tenantId), isNull(libraryBibliographicRecords.deletedAt)];
  if (input.query?.trim()) where.push(ilike(libraryBibliographicRecords.title, `%${input.query.trim()}%`));
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const order = input.sortBy === 'created'
    ? desc(libraryBibliographicRecords.createdAt)
    : input.sortBy === 'updated'
      ? desc(libraryBibliographicRecords.updatedAt)
      : asc(libraryBibliographicRecords.title);
  const [records, totalRows] = await Promise.all([
    db.select().from(libraryBibliographicRecords).where(and(...where)).orderBy(order).limit(limit).offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryBibliographicRecords).where(and(...where)),
  ]);
  if (records.length === 0) return { items: [], total: Number(totalRows[0]?.n ?? 0), offset, limit };
  const recordIds = records.map(r => r.id);
  const editions = await db.select().from(libraryEditions)
    .where(and(eq(libraryEditions.tenantId, tenantId), inArray(libraryEditions.recordId, recordIds)));
  const editionIds = editions.map(e => e.id);
  const copyCounts = editionIds.length === 0 ? [] : await db
    .select({ editionId: libraryCopies.editionId, total: sql<number>`count(*)::int`, available: sql<number>`count(*) filter (where ${libraryCopies.state} = 'available')::int` })
    .from(libraryCopies)
    .where(and(eq(libraryCopies.tenantId, tenantId), inArray(libraryCopies.editionId, editionIds)))
    .groupBy(libraryCopies.editionId);
  return {
    items: records.map(record => ({
      ...record,
      editions: editions.filter(e => e.recordId === record.id).map(edition => ({
        ...edition,
        copies: copyCounts.find(c => c.editionId === edition.id) ?? { total: 0, available: 0 },
      })),
    })),
    total: Number(totalRows[0]?.n ?? 0),
    offset,
    limit,
  };
}

// ---------------------------------------------------------------------------
// Record detail / update / soft-delete
// ---------------------------------------------------------------------------

export async function getCatalogRecord(tenantId: string, recordId: string) {
  const [record] = await db.select().from(libraryBibliographicRecords)
    .where(and(eq(libraryBibliographicRecords.id, recordId), eq(libraryBibliographicRecords.tenantId, tenantId), isNull(libraryBibliographicRecords.deletedAt))).limit(1);
  if (!record) throw new ApiError(404, 'NOT_FOUND', 'Notice bibliographique introuvable.');
  const editions = await db.select().from(libraryEditions)
    .where(and(eq(libraryEditions.tenantId, tenantId), eq(libraryEditions.recordId, recordId)))
    .orderBy(asc(libraryEditions.createdAt));
  const editionIds = editions.map(e => e.id);
  const copies = editionIds.length === 0 ? [] : await db
    .select({ ...getTableColumns(libraryCopies), branchName: branches.name })
    .from(libraryCopies)
    .innerJoin(branches, eq(libraryCopies.branchId, branches.id))
    .where(and(eq(libraryCopies.tenantId, tenantId), inArray(libraryCopies.editionId, editionIds)))
    .orderBy(asc(libraryCopies.createdAt));
  const copyIds = copies.map(c => c.id);
  const [contributors, subjects, holds] = await Promise.all([
    db.select({ id: libraryContributors.id, name: libraryContributors.name, primaryRole: libraryContributors.primaryRole, role: libraryRecordContributors.role, sortOrder: libraryRecordContributors.sortOrder })
      .from(libraryRecordContributors)
      .innerJoin(libraryContributors, eq(libraryRecordContributors.contributorId, libraryContributors.id))
      .where(and(eq(libraryRecordContributors.tenantId, tenantId), eq(libraryRecordContributors.recordId, recordId)))
      .orderBy(asc(libraryRecordContributors.sortOrder), asc(libraryContributors.name)),
    db.select({ id: librarySubjects.id, name: librarySubjects.name })
      .from(libraryRecordSubjects)
      .innerJoin(librarySubjects, eq(libraryRecordSubjects.subjectId, librarySubjects.id))
      .where(and(eq(libraryRecordSubjects.tenantId, tenantId), eq(libraryRecordSubjects.recordId, recordId)))
      .orderBy(asc(librarySubjects.name)),
    copyIds.length === 0 ? [] : db
      .select({ id: libraryHolds.id, state: libraryHolds.state, placedAt: libraryHolds.placedAt, copyId: libraryHolds.copyId, memberName: user.name, memberNumber: libraryMembers.memberNumber })
      .from(libraryHolds)
      .innerJoin(libraryMembers, eq(libraryHolds.memberId, libraryMembers.id))
      .innerJoin(user, eq(libraryMembers.userId, user.id))
      .where(and(eq(libraryHolds.tenantId, tenantId), inArray(libraryHolds.copyId, copyIds)))
      .orderBy(asc(libraryHolds.placedAt)),
  ]);
  return {
    ...record,
    editions: editions.map(edition => ({ ...edition, copies: copies.filter(c => c.editionId === edition.id) })),
    contributors,
    subjects,
    holds,
  };
}

export async function updateCatalogRecord(tenantId: string, recordId: string, input: {
  title?: string; subtitle?: string | null; language?: string | null; publicationYear?: number | null; summary?: string | null;
}) {
  const [row] = await db.update(libraryBibliographicRecords)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(libraryBibliographicRecords.id, recordId), eq(libraryBibliographicRecords.tenantId, tenantId), isNull(libraryBibliographicRecords.deletedAt)))
    .returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Notice bibliographique introuvable.');
  return row;
}

export async function deleteCatalogRecord(tenantId: string, recordId: string) {
  const editions = await db.select({ id: libraryEditions.id }).from(libraryEditions)
    .where(and(eq(libraryEditions.tenantId, tenantId), eq(libraryEditions.recordId, recordId)));
  const editionIds = editions.map(e => e.id);
  const [active] = editionIds.length === 0 ? [{ n: 0 }] : await db
    .select({ n: sql<number>`count(*)::int` }).from(libraryCopies)
    .where(and(eq(libraryCopies.tenantId, tenantId), inArray(libraryCopies.editionId, editionIds), inArray(libraryCopies.state, ['checked_out', 'on_hold_shelf', 'in_transit'])));
  if (Number(active?.n ?? 0) > 0) throw new ApiError(409, 'RECORD_IN_CIRCULATION', 'La notice a des exemplaires en circulation.');
  const [row] = await db.update(libraryBibliographicRecords)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(libraryBibliographicRecords.id, recordId), eq(libraryBibliographicRecords.tenantId, tenantId), isNull(libraryBibliographicRecords.deletedAt)))
    .returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Notice bibliographique introuvable.');
  return row;
}

// ---------------------------------------------------------------------------
// Record contributors / subjects (replace-style link setters)
// ---------------------------------------------------------------------------

export async function setRecordContributors(tenantId: string, recordId: string, links: Array<{ contributorId: string; role: string; sortOrder?: number }>) {
  return db.transaction(async tx => {
    const [record] = await tx.select({ id: libraryBibliographicRecords.id }).from(libraryBibliographicRecords)
      .where(and(eq(libraryBibliographicRecords.id, recordId), eq(libraryBibliographicRecords.tenantId, tenantId), isNull(libraryBibliographicRecords.deletedAt))).limit(1);
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'Notice bibliographique introuvable.');
    const ids = [...new Set(links.map(l => l.contributorId))];
    if (ids.length) {
      const found = await tx.select({ id: libraryContributors.id }).from(libraryContributors)
        .where(and(eq(libraryContributors.tenantId, tenantId), inArray(libraryContributors.id, ids)));
      if (found.length !== ids.length) throw new ApiError(422, 'INVALID_REFERENCE', 'Contributeur introuvable.');
    }
    await tx.delete(libraryRecordContributors).where(and(eq(libraryRecordContributors.tenantId, tenantId), eq(libraryRecordContributors.recordId, recordId)));
    if (links.length === 0) return [];
    return tx.insert(libraryRecordContributors).values(
      links.map((l, i) => ({ tenantId, recordId, contributorId: l.contributorId, role: l.role, sortOrder: l.sortOrder ?? i })),
    ).onConflictDoNothing().returning();
  });
}

export async function setRecordSubjects(tenantId: string, recordId: string, subjectIds: string[]) {
  return db.transaction(async tx => {
    const [record] = await tx.select({ id: libraryBibliographicRecords.id }).from(libraryBibliographicRecords)
      .where(and(eq(libraryBibliographicRecords.id, recordId), eq(libraryBibliographicRecords.tenantId, tenantId), isNull(libraryBibliographicRecords.deletedAt))).limit(1);
    if (!record) throw new ApiError(404, 'NOT_FOUND', 'Notice bibliographique introuvable.');
    const ids = [...new Set(subjectIds)];
    if (ids.length) {
      const found = await tx.select({ id: librarySubjects.id }).from(librarySubjects)
        .where(and(eq(librarySubjects.tenantId, tenantId), inArray(librarySubjects.id, ids)));
      if (found.length !== ids.length) throw new ApiError(422, 'INVALID_REFERENCE', 'Sujet introuvable.');
    }
    await tx.delete(libraryRecordSubjects).where(and(eq(libraryRecordSubjects.tenantId, tenantId), eq(libraryRecordSubjects.recordId, recordId)));
    if (ids.length === 0) return [];
    return tx.insert(libraryRecordSubjects).values(ids.map(subjectId => ({ tenantId, recordId, subjectId }))).onConflictDoNothing().returning();
  });
}

// ---------------------------------------------------------------------------
// Editions CRUD
// ---------------------------------------------------------------------------

export async function listEditions(tenantId: string, recordId?: string) {
  const where = [eq(libraryEditions.tenantId, tenantId)];
  if (recordId) where.push(eq(libraryEditions.recordId, recordId));
  return db.select().from(libraryEditions).where(and(...where)).orderBy(asc(libraryEditions.createdAt));
}

export async function getEdition(tenantId: string, id: string) {
  const [row] = await db.select().from(libraryEditions)
    .where(and(eq(libraryEditions.id, id), eq(libraryEditions.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Édition introuvable.');
  return row;
}

export async function updateEdition(tenantId: string, id: string, input: {
  publisherId?: string | null; isbn13?: string | null; isbn10?: string | null; publicationYear?: number | null;
  pages?: number | null; format?: string | null; coverUrl?: string | null;
}) {
  if (input.publisherId) {
    const [publisher] = await db.select({ id: libraryPublishers.id }).from(libraryPublishers)
      .where(and(eq(libraryPublishers.id, input.publisherId), eq(libraryPublishers.tenantId, tenantId))).limit(1);
    if (!publisher) throw new ApiError(422, 'INVALID_REFERENCE', 'Éditeur introuvable.');
  }
  try {
    const [row] = await db.update(libraryEditions).set({ ...input, updatedAt: new Date().toISOString() })
      .where(and(eq(libraryEditions.id, id), eq(libraryEditions.tenantId, tenantId))).returning();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Édition introuvable.');
    return row;
  } catch (error) {
    assertUniqueViolation(error, 'DUPLICATE_ISBN', 'Cet ISBN existe déjà.');
    throw error;
  }
}

export async function deleteEdition(tenantId: string, id: string) {
  const [copies] = await db.select({ n: sql<number>`count(*)::int` }).from(libraryCopies)
    .where(and(eq(libraryCopies.tenantId, tenantId), eq(libraryCopies.editionId, id)));
  if (Number(copies?.n ?? 0) > 0) throw new ApiError(409, 'EDITION_IN_USE', 'Supprimez d’abord les exemplaires de cette édition.');
  const [row] = await db.delete(libraryEditions)
    .where(and(eq(libraryEditions.id, id), eq(libraryEditions.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Édition introuvable.');
  return row;
}

// ---------------------------------------------------------------------------
// Copies CRUD
// ---------------------------------------------------------------------------

type LibraryCopyState = typeof libraryCopies.$inferSelect.state;

export async function listCopies(tenantId: string, input: { query?: string; state?: string; branchId?: string; offset?: number; limit?: number } = {}) {
  const where = [eq(libraryCopies.tenantId, tenantId)];
  if (input.state) where.push(eq(libraryCopies.state, input.state as LibraryCopyState));
  if (input.branchId) where.push(eq(libraryCopies.branchId, input.branchId));
  if (input.query?.trim()) {
    const q = `%${input.query.trim()}%`;
    where.push(or(
      ilike(libraryCopies.accessionNumber, q),
      ilike(libraryCopies.barcode, q),
      ilike(libraryBibliographicRecords.title, q),
      ilike(libraryEditions.isbn13, q),
    ) ?? sql`false`);
  }
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const [rows, totalRows] = await Promise.all([
    db.select({ ...getTableColumns(libraryCopies), title: libraryBibliographicRecords.title, isbn13: libraryEditions.isbn13, branchName: branches.name })
      .from(libraryCopies)
      .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
      .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
      .innerJoin(branches, eq(libraryCopies.branchId, branches.id))
      .where(and(...where))
      .orderBy(desc(libraryCopies.createdAt)).limit(limit).offset(offset),
    db.select({ n: sql<number>`count(*)::int` })
      .from(libraryCopies)
      .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
      .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
      .where(and(...where)),
  ]);
  return { items: rows, total: Number(totalRows[0]?.n ?? 0), offset, limit };
}

export async function getCopy(tenantId: string, id: string) {
  const [row] = await db.select({ ...getTableColumns(libraryCopies), title: libraryBibliographicRecords.title, isbn13: libraryEditions.isbn13, branchName: branches.name })
    .from(libraryCopies)
    .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
    .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
    .innerJoin(branches, eq(libraryCopies.branchId, branches.id))
    .where(and(eq(libraryCopies.id, id), eq(libraryCopies.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Exemplaire introuvable.');
  return row;
}

export async function updateCopy(tenantId: string, id: string, input: {
  shelfLocation?: string | null; condition?: 'new' | 'good' | 'fair' | 'poor' | 'damaged';
  price?: string | null; acquiredAt?: string | null; branchId?: string | null;
}) {
  return db.transaction(async tx => {
    const [copy] = await tx.select().from(libraryCopies)
      .where(and(eq(libraryCopies.id, id), eq(libraryCopies.tenantId, tenantId))).for('update').limit(1);
    if (!copy) throw new ApiError(404, 'NOT_FOUND', 'Exemplaire introuvable.');
    let branchId = input.branchId;
    if (branchId && branchId !== copy.branchId) {
      // Re-homing is a transfer; a free copy may also be reassigned directly.
      if (copy.state !== 'available') throw new ApiError(409, 'COPY_NOT_FREE', 'Déplacez l’exemplaire via un transfert.');
      const [branch] = await tx.select({ id: branches.id }).from(branches)
        .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId))).limit(1);
      if (!branch) throw new ApiError(422, 'INVALID_REFERENCE', 'Succursale introuvable.');
    } else {
      branchId = undefined;
    }
    const { branchId: _ignored, ...rest } = input;
    const [row] = await tx.update(libraryCopies)
      .set({ ...rest, ...(branchId ? { branchId } : {}), updatedAt: new Date().toISOString() })
      .where(eq(libraryCopies.id, copy.id)).returning();
    return row!;
  });
}

export async function deleteCopy(tenantId: string, id: string) {
  const [copy] = await db.select({ id: libraryCopies.id, state: libraryCopies.state }).from(libraryCopies)
    .where(and(eq(libraryCopies.id, id), eq(libraryCopies.tenantId, tenantId))).limit(1);
  if (!copy) throw new ApiError(404, 'NOT_FOUND', 'Exemplaire introuvable.');
  if (!['available', 'missing', 'repair', 'lost'].includes(copy.state)) {
    throw new ApiError(409, 'COPY_NOT_WITHDRAWABLE', 'Exemplaire prêté, réservé ou en transit — non retirable.');
  }
  const now = new Date().toISOString();
  const [row] = await db.update(libraryCopies)
    .set({ state: 'withdrawn', withdrawnAt: now, updatedAt: now })
    .where(eq(libraryCopies.id, copy.id)).returning();
  return row!;
}

// ---------------------------------------------------------------------------
// Taxonomy CRUD (contributors / publishers / categories / subjects)
// ---------------------------------------------------------------------------

export async function listContributors(tenantId: string, query = '') {
  const where = [eq(libraryContributors.tenantId, tenantId)];
  if (query.trim()) where.push(ilike(libraryContributors.name, `%${query.trim()}%`));
  return db.select().from(libraryContributors).where(and(...where)).orderBy(asc(libraryContributors.name));
}

export async function createContributor(tenantId: string, input: { name: string; primaryRole?: string | null }) {
  try {
    const [row] = await db.insert(libraryContributors).values({ tenantId, ...input }).returning();
    return row!;
  } catch (error) {
    assertUniqueViolation(error, 'DUPLICATE_CONTRIBUTOR', 'Ce contributeur existe déjà.');
    throw error;
  }
}

export async function updateContributor(tenantId: string, id: string, input: { name?: string; primaryRole?: string | null }) {
  const [row] = await db.update(libraryContributors).set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(libraryContributors.id, id), eq(libraryContributors.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Contributeur introuvable.');
  return row;
}

export async function deleteContributor(tenantId: string, id: string) {
  const [row] = await db.delete(libraryContributors)
    .where(and(eq(libraryContributors.id, id), eq(libraryContributors.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Contributeur introuvable.');
  return row;
}

export async function listPublishers(tenantId: string, query = '') {
  const where = [eq(libraryPublishers.tenantId, tenantId)];
  if (query.trim()) where.push(ilike(libraryPublishers.name, `%${query.trim()}%`));
  return db.select().from(libraryPublishers).where(and(...where)).orderBy(asc(libraryPublishers.name));
}

export async function createPublisher(tenantId: string, input: { name: string; city?: string | null; country?: string | null }) {
  try {
    const [row] = await db.insert(libraryPublishers).values({ tenantId, ...input }).returning();
    return row!;
  } catch (error) {
    assertUniqueViolation(error, 'DUPLICATE_PUBLISHER', 'Cet éditeur existe déjà.');
    throw error;
  }
}

export async function updatePublisher(tenantId: string, id: string, input: { name?: string; city?: string | null; country?: string | null }) {
  const [row] = await db.update(libraryPublishers).set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(libraryPublishers.id, id), eq(libraryPublishers.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Éditeur introuvable.');
  return row;
}

export async function deletePublisher(tenantId: string, id: string) {
  const [row] = await db.delete(libraryPublishers)
    .where(and(eq(libraryPublishers.id, id), eq(libraryPublishers.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Éditeur introuvable.');
  return row;
}

export async function listCategories(tenantId: string, query = '') {
  const where = [eq(libraryCategories.tenantId, tenantId)];
  if (query.trim()) where.push(ilike(libraryCategories.name, `%${query.trim()}%`));
  return db.select().from(libraryCategories).where(and(...where)).orderBy(asc(libraryCategories.sortOrder), asc(libraryCategories.name));
}

export async function createCategory(tenantId: string, input: { name: string; parentId?: string | null; sortOrder?: number }) {
  if (input.parentId) {
    const [parent] = await db.select({ id: libraryCategories.id }).from(libraryCategories)
      .where(and(eq(libraryCategories.id, input.parentId), eq(libraryCategories.tenantId, tenantId))).limit(1);
    if (!parent) throw new ApiError(422, 'INVALID_REFERENCE', 'Catégorie parente introuvable.');
  }
  try {
    const [row] = await db.insert(libraryCategories).values({ tenantId, ...input }).returning();
    return row!;
  } catch (error) {
    assertUniqueViolation(error, 'DUPLICATE_CATEGORY', 'Catégorie déjà existante.');
    throw error;
  }
}

export async function updateCategory(tenantId: string, id: string, input: { name?: string; parentId?: string | null; sortOrder?: number }) {
  if (input.parentId && input.parentId !== id) {
    const [parent] = await db.select({ id: libraryCategories.id }).from(libraryCategories)
      .where(and(eq(libraryCategories.id, input.parentId), eq(libraryCategories.tenantId, tenantId))).limit(1);
    if (!parent) throw new ApiError(422, 'INVALID_REFERENCE', 'Catégorie parente introuvable.');
  }
  const [row] = await db.update(libraryCategories).set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(libraryCategories.id, id), eq(libraryCategories.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Catégorie introuvable.');
  return row;
}

export async function deleteCategory(tenantId: string, id: string) {
  const [row] = await db.delete(libraryCategories)
    .where(and(eq(libraryCategories.id, id), eq(libraryCategories.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Catégorie introuvable.');
  return row;
}

export async function listSubjects(tenantId: string, query = '') {
  const where = [eq(librarySubjects.tenantId, tenantId)];
  if (query.trim()) where.push(ilike(librarySubjects.name, `%${query.trim()}%`));
  return db.select().from(librarySubjects).where(and(...where)).orderBy(asc(librarySubjects.name));
}

export async function createSubject(tenantId: string, input: { name: string }) {
  try {
    const [row] = await db.insert(librarySubjects).values({ tenantId, ...input }).returning();
    return row!;
  } catch (error) {
    assertUniqueViolation(error, 'DUPLICATE_SUBJECT', 'Ce sujet existe déjà.');
    throw error;
  }
}

export async function updateSubject(tenantId: string, id: string, input: { name?: string }) {
  const [row] = await db.update(librarySubjects).set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(eq(librarySubjects.id, id), eq(librarySubjects.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Sujet introuvable.');
  return row;
}

export async function deleteSubject(tenantId: string, id: string) {
  const [row] = await db.delete(librarySubjects)
    .where(and(eq(librarySubjects.id, id), eq(librarySubjects.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Sujet introuvable.');
  return row;
}
