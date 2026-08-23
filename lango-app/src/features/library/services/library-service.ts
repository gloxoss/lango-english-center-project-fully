import { and, asc, desc, eq, getTableColumns, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { cancelHold } from '@/features/library/services/library-operations-service';
import {
  branches,
  guardianStudents,
  guardians,
  libraryBibliographicRecords,
  libraryCharges,
  libraryClosureDays,
  libraryCopies,
  libraryEditions,
  libraryHoldEvents,
  libraryHolds,
  libraryLoanEvents,
  libraryLoanPolicies,
  libraryLoans,
  libraryMembers,
  user,
} from '@/models/Schema';

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

// Due date = start + durationDays open days, skipping branch-scoped and
// tenant-wide (branchId NULL) closure dates. With no closures this matches
// addDays exactly, so existing behavior is preserved.
async function computeDueDate(tx: DbExecutor, tenantId: string, branchId: string, start: Date, durationDays: number): Promise<string> {
  if (durationDays <= 0) return start.toISOString().slice(0, 10);
  const days = await tx.select({ closedOn: libraryClosureDays.closedOn }).from(libraryClosureDays)
    .where(and(eq(libraryClosureDays.tenantId, tenantId), or(eq(libraryClosureDays.branchId, branchId), isNull(libraryClosureDays.branchId))));
  const closed = new Set(days.map(d => d.closedOn));
  const due = new Date(start);
  let remaining = durationDays;
  while (remaining > 0) {
    due.setUTCDate(due.getUTCDate() + 1);
    if (!closed.has(due.toISOString().slice(0, 10))) remaining -= 1;
  }
  return due.toISOString().slice(0, 10);
}

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

export async function listCatalog(tenantId: string, query = '', limit = 50) {
  const where = [eq(libraryBibliographicRecords.tenantId, tenantId), isNull(libraryBibliographicRecords.deletedAt)];
  if (query.trim()) where.push(ilike(libraryBibliographicRecords.title, `%${query.trim()}%`));
  const records = await db.select().from(libraryBibliographicRecords)
    .where(and(...where)).orderBy(asc(libraryBibliographicRecords.title)).limit(Math.min(100, Math.max(1, limit)));
  if (records.length === 0) return [];
  const recordIds = records.map(r => r.id);
  const editions = await db.select().from(libraryEditions)
    .where(and(eq(libraryEditions.tenantId, tenantId), inArray(libraryEditions.recordId, recordIds)));
  const editionIds = editions.map(e => e.id);
  const copyCounts = editionIds.length === 0 ? [] : await db
    .select({ editionId: libraryCopies.editionId, total: sql<number>`count(*)::int`, available: sql<number>`count(*) filter (where ${libraryCopies.state} = 'available')::int` })
    .from(libraryCopies)
    .where(and(eq(libraryCopies.tenantId, tenantId), inArray(libraryCopies.editionId, editionIds)))
    .groupBy(libraryCopies.editionId);
  return records.map(record => {
    const ownEditions = editions.filter(e => e.recordId === record.id);
    return {
      ...record,
      editions: ownEditions.map(edition => ({
        ...edition,
        copies: copyCounts.find(c => c.editionId === edition.id) ?? { total: 0, available: 0 },
      })),
    };
  });
}

export async function createCatalogRecord(tenantId: string, input: {
  title: string; subtitle?: string | null; language?: string | null; publicationYear?: number | null; summary?: string | null;
}) {
  const [row] = await db.insert(libraryBibliographicRecords).values({ tenantId, ...input }).returning();
  return row!;
}

export async function createEdition(tenantId: string, input: {
  recordId: string; publisherId?: string | null; isbn13?: string | null; isbn10?: string | null;
  publicationYear?: number | null; pages?: number | null; format?: string | null; coverUrl?: string | null;
}) {
  const [record] = await db.select({ id: libraryBibliographicRecords.id }).from(libraryBibliographicRecords)
    .where(and(eq(libraryBibliographicRecords.id, input.recordId), eq(libraryBibliographicRecords.tenantId, tenantId), isNull(libraryBibliographicRecords.deletedAt))).limit(1);
  if (!record) throw new ApiError(422, 'INVALID_REFERENCE', 'Notice bibliographique introuvable.');
  try {
    const [row] = await db.insert(libraryEditions).values({ tenantId, ...input }).returning();
    return row!;
  } catch (error) {
    assertUniqueViolation(error, 'DUPLICATE_ISBN', 'Cet ISBN existe déjà.');
    throw error;
  }
}

export async function createCopy(tenantId: string, input: {
  editionId: string; branchId: string; accessionNumber: string; barcode?: string | null; shelfLocation?: string | null;
  condition?: 'new' | 'good' | 'fair' | 'poor' | 'damaged'; price?: string | null; acquiredAt?: string | null;
}) {
  const [[edition], [branch]] = await Promise.all([
    db.select({ id: libraryEditions.id }).from(libraryEditions)
      .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
      .where(and(eq(libraryEditions.id, input.editionId), eq(libraryEditions.tenantId, tenantId), isNull(libraryBibliographicRecords.deletedAt)))
      .limit(1),
    db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId))).limit(1),
  ]);
  if (!edition || !branch) throw new ApiError(422, 'INVALID_REFERENCE', 'Édition ou succursale introuvable.');
  try {
    const [row] = await db.insert(libraryCopies).values({ tenantId, ...input }).returning();
    return row!;
  } catch (error) {
    assertUniqueViolation(error, 'DUPLICATE_COPY_IDENTIFIER', 'Numéro d’inventaire ou code-barres déjà utilisé.');
    throw error;
  }
}

export async function listMembers(tenantId: string, query = '') {
  const conditions = [eq(libraryMembers.tenantId, tenantId), eq(user.tenantId, tenantId)];
  if (query.trim()) conditions.push(or(ilike(user.name, `%${query.trim()}%`), ilike(libraryMembers.memberNumber, `%${query.trim()}%`))!);
  return db.select({
    id: libraryMembers.id, memberNumber: libraryMembers.memberNumber, state: libraryMembers.state,
    blockReason: libraryMembers.blockReason, blockUntil: libraryMembers.blockUntil,
    userId: user.id, name: user.name, email: user.email, role: user.role, branchId: libraryMembers.branchId,
  }).from(libraryMembers).innerJoin(user, eq(libraryMembers.userId, user.id))
    .where(and(...conditions)).orderBy(asc(user.name)).limit(50);
}

export async function getMemberDetail(tenantId: string, memberId: string) {
  const [member] = await db.select({
    ...getTableColumns(libraryMembers),
    branchName: branches.name,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }).from(libraryMembers)
    .innerJoin(branches, eq(libraryMembers.branchId, branches.id))
    .innerJoin(user, eq(libraryMembers.userId, user.id))
    .where(and(eq(libraryMembers.id, memberId), eq(libraryMembers.tenantId, tenantId), eq(user.tenantId, tenantId)))
    .limit(1);
  if (!member) throw new ApiError(404, 'NOT_FOUND', 'Adhérent introuvable.');

  const [activeLoans, openCharges, waitingHolds] = await Promise.all([
    db.select({ loanId: libraryLoans.id, dueDate: libraryLoans.dueDate, issuedAt: libraryLoans.issuedAt, renewedCount: libraryLoans.renewedCount, accessionNumber: libraryCopies.accessionNumber, title: libraryBibliographicRecords.title })
      .from(libraryLoans)
      .innerJoin(libraryCopies, eq(libraryLoans.copyId, libraryCopies.id))
      .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
      .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
      .where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.memberId, memberId), isNull(libraryLoans.returnedAt)))
      .orderBy(desc(libraryLoans.issuedAt)).limit(50),
    db.select({ id: libraryCharges.id, amount: libraryCharges.amount, reason: libraryCharges.reason, state: libraryCharges.state, createdAt: libraryCharges.createdAt })
      .from(libraryCharges)
      .where(and(eq(libraryCharges.tenantId, tenantId), eq(libraryCharges.memberId, memberId), eq(libraryCharges.state, 'open')))
      .orderBy(desc(libraryCharges.createdAt)).limit(50),
    db.select({ id: libraryHolds.id, placedAt: libraryHolds.placedAt, expiresAt: libraryHolds.expiresAt, accessionNumber: libraryCopies.accessionNumber, title: libraryBibliographicRecords.title })
      .from(libraryHolds)
      .innerJoin(libraryCopies, eq(libraryHolds.copyId, libraryCopies.id))
      .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
      .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
      .where(and(eq(libraryHolds.tenantId, tenantId), eq(libraryHolds.memberId, memberId), eq(libraryHolds.state, 'waiting')))
      .orderBy(asc(libraryHolds.placedAt)).limit(50),
  ]);
  return { ...member, activeLoans, openCharges, waitingHolds };
}

export async function createMember(tenantId: string, input: { userId: string; memberNumber: string; branchId: string }) {
  const [[person], [branch]] = await Promise.all([
    db.select({ id: user.id }).from(user).where(and(eq(user.id, input.userId), eq(user.tenantId, tenantId), eq(user.userStatus, 'active'))).limit(1),
    db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId))).limit(1),
  ]);
  if (!person || !branch) throw new ApiError(422, 'INVALID_REFERENCE', 'Utilisateur ou succursale introuvable.');
  try {
    const [row] = await db.insert(libraryMembers).values({ tenantId, ...input }).returning();
    return row!;
  } catch (error) {
    assertUniqueViolation(error, 'MEMBER_EXISTS', 'Cet utilisateur possède déjà un compte bibliothèque.');
    throw error;
  }
}

// Resolves the applicable loan policy for a member with branch-specific policy
// precedence (a branch policy beats the tenant-wide generic policy). Returns
// whether the member is currently blocked so callers can apply override logic.
async function resolveMemberPolicy(tx: DbExecutor, tenantId: string, memberId: string) {
  const [member] = await tx.select({ id: libraryMembers.id, state: libraryMembers.state, blockUntil: libraryMembers.blockUntil, branchId: libraryMembers.branchId, role: user.role })
    .from(libraryMembers).innerJoin(user, eq(libraryMembers.userId, user.id))
    .where(and(eq(libraryMembers.id, memberId), eq(libraryMembers.tenantId, tenantId), eq(user.tenantId, tenantId))).limit(1);
  if (!member) throw new ApiError(422, 'INVALID_MEMBER', 'Adhérent introuvable.');
  const today = new Date().toISOString().slice(0, 10);
  const blocked = member.state !== 'active' || Boolean(member.blockUntil && member.blockUntil >= today);
  // Prefer the branch-specific policy: sort non-null branchId first, then the
  // branch id. Postgres DESC would put NULL (generic) first - that is wrong.
  const [policy] = await tx.select().from(libraryLoanPolicies)
    .where(and(eq(libraryLoanPolicies.tenantId, tenantId), eq(libraryLoanPolicies.patronCategory, member.role), or(eq(libraryLoanPolicies.branchId, member.branchId), isNull(libraryLoanPolicies.branchId))))
    .orderBy(sql`case when ${libraryLoanPolicies.branchId} is null then 1 else 0 end`, asc(libraryLoanPolicies.branchId)).limit(1);
  if (!policy) throw new ApiError(409, 'POLICY_NOT_CONFIGURED', 'Aucune politique de prêt applicable.');
  return { member, policy, blocked };
}

// Creates a charge when one does not already exist for this loan+reason.
// Idempotent by the DB partial-unique (tenant_id, loan_id, reason) index.
async function chargeLoanOnce(tx: DbExecutor, tenantId: string, loan: { memberId: string; id: string }, reason: 'overdue_fine' | 'lost_copy', amount: string) {
  if (Number(amount) <= 0) return null;
  const [charge] = await tx.insert(libraryCharges).values({ tenantId, memberId: loan.memberId, loanId: loan.id, amount, reason })
    .onConflictDoNothing().returning();
  return charge ?? null;
}

export async function issueCopy(tenantId: string, actorId: string, input: { copyId: string; memberId: string; note?: string | null; idempotencyKey?: string | null; override?: boolean; overrideReason?: string | null }) {
  const override = input.override === true && Boolean(input.overrideReason);
  return db.transaction(async tx => {
    // Idempotent checkout: a repeated scan with the same key returns the loan.
    if (input.idempotencyKey) {
      const [existing] = await tx.select().from(libraryLoans)
        .where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.idempotencyKey, input.idempotencyKey))).limit(1);
      if (existing) return existing;
    }
    const { policy, blocked } = await resolveMemberPolicy(tx, tenantId, input.memberId);
    if (blocked && !override) throw new ApiError(409, 'MEMBER_BLOCKED', 'Le compte de l’adhérent est bloqué.');
    const [copy] = await tx.select().from(libraryCopies)
      .where(and(eq(libraryCopies.id, input.copyId), eq(libraryCopies.tenantId, tenantId))).for('update').limit(1);
    if (!copy) throw new ApiError(422, 'INVALID_COPY', 'Exemplaire introuvable.');
    // A double loan is never allowed, even with override - the DB partial-unique
    // index is the final arbiter for concurrent workers.
    if (copy.state === 'checked_out' || copy.state === 'in_transit' || copy.state === 'lost' || copy.state === 'withdrawn') {
      throw new ApiError(409, 'COPY_UNAVAILABLE', 'Exemplaire non disponible.');
    }
    const [activeCount] = await tx.select({ n: sql<number>`count(*)::int` }).from(libraryLoans)
      .where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.memberId, input.memberId), isNull(libraryLoans.returnedAt)));
    if (!override && Number(activeCount?.n ?? 0) >= policy.maxLoans) throw new ApiError(409, 'LOAN_LIMIT_REACHED', 'Limite de prêts atteinte.');
    const [firstHold] = await tx.select({ id: libraryHolds.id, memberId: libraryHolds.memberId }).from(libraryHolds)
      .where(and(eq(libraryHolds.tenantId, tenantId), eq(libraryHolds.copyId, copy.id), eq(libraryHolds.state, 'waiting')))
      .orderBy(asc(libraryHolds.placedAt), asc(libraryHolds.id)).limit(1);
    if (firstHold && firstHold.memberId !== input.memberId && !override) throw new ApiError(409, 'COPY_RESERVED', 'Exemplaire réservé à un autre adhérent.');
    const now = new Date();
    const issuedNote = override ? (input.overrideReason ?? input.note) : input.note;
    const loan = await (async () => {
      try {
        const [created] = await tx.insert(libraryLoans).values({
          tenantId, copyId: copy.id, memberId: input.memberId, issuedById: actorId,
          issuedAt: now.toISOString(), dueDate: await computeDueDate(tx, tenantId, copy.branchId, now, policy.loanDurationDays),
          policySnapshot: policy, note: issuedNote ?? null, idempotencyKey: input.idempotencyKey ?? null,
        }).returning();
        return created!;
      } catch (error) {
        // Concurrent retry of the same idempotency key: return the winner.
        if (input.idempotencyKey && pgErrorCode(error) === '23505') {
          const [winner] = await tx.select().from(libraryLoans)
            .where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.idempotencyKey, input.idempotencyKey))).limit(1);
          if (winner) return winner;
        }
        throw error;
      }
    })();
    await tx.update(libraryCopies).set({ state: 'checked_out', updatedAt: now.toISOString() }).where(and(eq(libraryCopies.id, copy.id), eq(libraryCopies.tenantId, tenantId)));
    await tx.insert(libraryLoanEvents).values({ tenantId, loanId: loan!.id, eventType: 'issued', actorId, note: issuedNote ?? null });
    if (firstHold && firstHold.memberId === input.memberId) {
      const [hold] = await tx.update(libraryHolds).set({ state: 'fulfilled', fulfilledLoanId: loan!.id })
        .where(and(eq(libraryHolds.tenantId, tenantId), eq(libraryHolds.copyId, copy.id), eq(libraryHolds.memberId, input.memberId), eq(libraryHolds.state, 'waiting'))).returning();
      if (hold) await tx.insert(libraryHoldEvents).values({ tenantId, holdId: hold.id, eventType: 'fulfilled', actorId });
    }
    return loan!;
  });
}

export async function listActiveLoans(tenantId: string) {
  return db.select({
    loanId: libraryLoans.id, dueDate: libraryLoans.dueDate, renewedCount: libraryLoans.renewedCount, issuedAt: libraryLoans.issuedAt,
    copyId: libraryCopies.id, accessionNumber: libraryCopies.accessionNumber, title: libraryBibliographicRecords.title,
    memberId: libraryMembers.id, memberNumber: libraryMembers.memberNumber, memberName: user.name,
  }).from(libraryLoans)
    .innerJoin(libraryCopies, eq(libraryLoans.copyId, libraryCopies.id))
    .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
    .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
    .innerJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
    .innerJoin(user, eq(libraryMembers.userId, user.id))
    .where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryCopies.tenantId, tenantId), eq(libraryMembers.tenantId, tenantId), isNull(libraryLoans.returnedAt)))
    .orderBy(desc(libraryLoans.issuedAt)).limit(200);
}

export async function renewLoan(tenantId: string, actorId: string, loanId: string, expectedRenewedCount?: number) {
  return db.transaction(async tx => {
    const [loan] = await tx.select().from(libraryLoans).where(and(eq(libraryLoans.id, loanId), eq(libraryLoans.tenantId, tenantId))).for('update').limit(1);
    if (!loan || loan.returnedAt) throw new ApiError(409, 'LOAN_NOT_ACTIVE', 'Prêt non actif.');
    // Optimistic-concurrency idempotency: if the caller's expected count no
    // longer matches, a previous retry already renewed - return it unchanged.
    if (expectedRenewedCount !== undefined && loan.renewedCount !== expectedRenewedCount) return loan;
    const snapshot = loan.policySnapshot as { renewalLimit?: number; renewalDurationDays?: number };
    if (loan.renewedCount >= Number(snapshot.renewalLimit ?? 0)) throw new ApiError(409, 'RENEWAL_LIMIT_REACHED', 'Limite de renouvellements atteinte.');
    const [hold] = await tx.select({ id: libraryHolds.id }).from(libraryHolds)
      .where(and(eq(libraryHolds.tenantId, tenantId), eq(libraryHolds.copyId, loan.copyId), eq(libraryHolds.state, 'waiting'))).limit(1);
    if (hold) throw new ApiError(409, 'COPY_RESERVED', 'Renouvellement impossible : une réservation est en attente.');
    const base = new Date(`${loan.dueDate}T00:00:00.000Z`);
    const [copyRow] = await tx.select({ branchId: libraryCopies.branchId }).from(libraryCopies)
      .where(and(eq(libraryCopies.id, loan.copyId), eq(libraryCopies.tenantId, tenantId))).limit(1);
    const dueDate = await computeDueDate(tx, tenantId, copyRow?.branchId ?? '', base, Number(snapshot.renewalDurationDays ?? 0));
    const [updated] = await tx.update(libraryLoans).set({ dueDate, renewedCount: loan.renewedCount + 1 })
      .where(and(eq(libraryLoans.id, loan.id), eq(libraryLoans.tenantId, tenantId), isNull(libraryLoans.returnedAt))).returning();
    await tx.insert(libraryLoanEvents).values({ tenantId, loanId: loan.id, eventType: 'renewed', actorId });
    return updated!;
  });
}

export async function returnLoan(tenantId: string, actorId: string, input: { loanId: string; condition: 'good' | 'damaged' | 'lost'; note?: string | null }) {
  return db.transaction(async tx => {
    const [loan] = await tx.select().from(libraryLoans).where(and(eq(libraryLoans.id, input.loanId), eq(libraryLoans.tenantId, tenantId))).for('update').limit(1);
    if (!loan) throw new ApiError(404, 'NOT_FOUND', 'Prêt introuvable.');
    // Idempotent return: a repeated/duplicate scan returns the already-closed loan.
    if (loan.returnedAt) return loan;
    const now = new Date();
    const nowIso = now.toISOString();
    const snapshot = loan.policySnapshot as { finePerDay?: string | number; gracePeriodDays?: number } | null;

    // Fine for late return (grace period applied). Idempotent via unique
    // (tenant, loan, reason). Only good/damaged returns are finable.
    if (input.condition !== 'lost') {
      const grace = Number(snapshot?.gracePeriodDays ?? 0);
      const finePerDay = Number(snapshot?.finePerDay ?? 0);
      const duePlusGrace = addDays(new Date(`${loan.dueDate}T00:00:00.000Z`), grace);
      if (finePerDay > 0 && now.getTime() > new Date(`${duePlusGrace}T00:00:00.000Z`).getTime()) {
        const daysLate = Math.floor((now.getTime() - new Date(`${duePlusGrace}T00:00:00.000Z`).getTime()) / DAY_MS);
        await chargeLoanOnce(tx, tenantId, { memberId: loan.memberId, id: loan.id }, 'overdue_fine', (finePerDay * daysLate).toFixed(2));
      }
    }

    // Lost-copy charge (copy price). Idempotent via unique (tenant, loan, reason).
    if (input.condition === 'lost') {
      const [copyRow] = await tx.select({ price: libraryCopies.price }).from(libraryCopies)
        .where(and(eq(libraryCopies.id, loan.copyId), eq(libraryCopies.tenantId, tenantId))).limit(1);
      const lostAmount = copyRow?.price ?? '0';
      await chargeLoanOnce(tx, tenantId, { memberId: loan.memberId, id: loan.id }, 'lost_copy', lostAmount);
    }

    const copyState = input.condition === 'good' ? 'available' : input.condition === 'damaged' ? 'repair' : 'lost';
    const [updated] = await tx.update(libraryLoans).set({ returnedAt: nowIso, returnState: input.condition, note: input.note ?? loan.note })
      .where(and(eq(libraryLoans.id, loan.id), eq(libraryLoans.tenantId, tenantId), isNull(libraryLoans.returnedAt))).returning();

    // Copy condition is only overwritten when the desk reports damage; a good
    // return never downgrades the recorded physical condition.
    await tx.update(libraryCopies).set({
      state: copyState,
      ...(input.condition === 'damaged' ? { condition: 'damaged' as const } : {}),
      updatedAt: nowIso,
    }).where(and(eq(libraryCopies.id, loan.copyId), eq(libraryCopies.tenantId, tenantId)));

    // Allocate the next FIFO hold: when a good copy returns and a hold waits for
    // it, hold it on the shelf instead of returning it to general availability.
    if (input.condition === 'good') {
      const [nextHold] = await tx.select({ id: libraryHolds.id }).from(libraryHolds)
        .where(and(eq(libraryHolds.tenantId, tenantId), eq(libraryHolds.copyId, loan.copyId), eq(libraryHolds.state, 'waiting')))
        .orderBy(asc(libraryHolds.placedAt), asc(libraryHolds.id)).limit(1);
      if (nextHold) {
        await tx.update(libraryCopies).set({ state: 'on_hold_shelf', updatedAt: nowIso })
          .where(and(eq(libraryCopies.id, loan.copyId), eq(libraryCopies.tenantId, tenantId)));
        await tx.insert(libraryHoldEvents).values({ tenantId, holdId: nextHold.id, eventType: 'notified', actorId, note: 'Exemplaire disponible pour retrait' });
      }
    }

    await tx.insert(libraryLoanEvents).values({ tenantId, loanId: loan.id, eventType: input.condition === 'lost' ? 'lost' : input.condition === 'damaged' ? 'damaged' : 'returned', actorId, note: input.note ?? null });
    return updated!;
  });
}

export async function libraryOverview(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [copies, loans, overdue, holds, members] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int`, available: sql<number>`count(*) filter (where ${libraryCopies.state} = 'available')::int` }).from(libraryCopies).where(eq(libraryCopies.tenantId, tenantId)),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), isNull(libraryLoans.returnedAt))),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), isNull(libraryLoans.returnedAt), sql`${libraryLoans.dueDate} < ${today}`)),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryHolds).where(and(eq(libraryHolds.tenantId, tenantId), eq(libraryHolds.state, 'waiting'))),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryMembers).where(and(eq(libraryMembers.tenantId, tenantId), eq(libraryMembers.state, 'active'))),
  ]);
  return { totalCopies: Number(copies[0]?.total ?? 0), availableCopies: Number(copies[0]?.available ?? 0), activeLoans: Number(loans[0]?.n ?? 0), overdueLoans: Number(overdue[0]?.n ?? 0), waitingHolds: Number(holds[0]?.n ?? 0), activeMembers: Number(members[0]?.n ?? 0) };
}

export async function listOwnLoans(tenantId: string, userId: string) {
  return db.select({ id: libraryLoans.id, dueDate: libraryLoans.dueDate, returnedAt: libraryLoans.returnedAt, renewedCount: libraryLoans.renewedCount, copyId: libraryCopies.id, accessionNumber: libraryCopies.accessionNumber, title: libraryBibliographicRecords.title })
    .from(libraryLoans)
    .innerJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id))
    .innerJoin(libraryCopies, eq(libraryLoans.copyId, libraryCopies.id))
    .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
    .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
    .where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryMembers.tenantId, tenantId), eq(libraryMembers.userId, userId), isNull(libraryLoans.returnedAt)))
    .orderBy(desc(libraryLoans.issuedAt)).limit(100);
}

// ---------------------------------------------------------------------------
// Member self-service (the caller's own library data only; the member is
// resolved from the session user, never from a client-supplied member id)
// ---------------------------------------------------------------------------

async function requireOwnMember(tenantId: string, userId: string) {
  const [member] = await db.select({ id: libraryMembers.id, memberNumber: libraryMembers.memberNumber }).from(libraryMembers)
    .where(and(eq(libraryMembers.tenantId, tenantId), eq(libraryMembers.userId, userId))).limit(1);
  if (!member) throw new ApiError(404, 'NOT_A_MEMBER', 'Aucun compte bibliothèque pour cet utilisateur.');
  return member;
}

export async function ownLibraryHome(tenantId: string, userId: string) {
  const member = await requireOwnMember(tenantId, userId);
  const today = new Date().toISOString().slice(0, 10);
  const [active, overdue, waitingHolds, openCharges] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.memberId, member.id), isNull(libraryLoans.returnedAt))),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.memberId, member.id), isNull(libraryLoans.returnedAt), sql`${libraryLoans.dueDate} < ${today}`)),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryHolds).where(and(eq(libraryHolds.tenantId, tenantId), eq(libraryHolds.memberId, member.id), eq(libraryHolds.state, 'waiting'))),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryCharges).where(and(eq(libraryCharges.tenantId, tenantId), eq(libraryCharges.memberId, member.id), eq(libraryCharges.state, 'open'))),
  ]);
  return { memberNumber: member.memberNumber, activeLoans: Number(active[0]?.n ?? 0), overdueLoans: Number(overdue[0]?.n ?? 0), waitingHolds: Number(waitingHolds[0]?.n ?? 0), openCharges: Number(openCharges[0]?.n ?? 0) };
}

export async function listOwnHistory(tenantId: string, userId: string) {
  const member = await requireOwnMember(tenantId, userId);
  return db.select({ id: libraryLoans.id, dueDate: libraryLoans.dueDate, returnedAt: libraryLoans.returnedAt, returnState: libraryLoans.returnState, renewedCount: libraryLoans.renewedCount, copyId: libraryCopies.id, accessionNumber: libraryCopies.accessionNumber, title: libraryBibliographicRecords.title })
    .from(libraryLoans)
    .innerJoin(libraryCopies, eq(libraryLoans.copyId, libraryCopies.id))
    .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
    .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
    .where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.memberId, member.id), isNotNull(libraryLoans.returnedAt)))
    .orderBy(desc(libraryLoans.returnedAt)).limit(100);
}

export async function listOwnHolds(tenantId: string, userId: string) {
  const member = await requireOwnMember(tenantId, userId);
  return db.select({ id: libraryHolds.id, state: libraryHolds.state, placedAt: libraryHolds.placedAt, expiresAt: libraryHolds.expiresAt, copyId: libraryCopies.id, accessionNumber: libraryCopies.accessionNumber, title: libraryBibliographicRecords.title })
    .from(libraryHolds)
    .innerJoin(libraryCopies, eq(libraryHolds.copyId, libraryCopies.id))
    .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
    .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
    .where(and(eq(libraryHolds.tenantId, tenantId), eq(libraryHolds.memberId, member.id)))
    .orderBy(desc(libraryHolds.placedAt)).limit(100);
}

export async function listOwnCharges(tenantId: string, userId: string) {
  const member = await requireOwnMember(tenantId, userId);
  return db.select({ id: libraryCharges.id, amount: libraryCharges.amount, reason: libraryCharges.reason, state: libraryCharges.state, createdAt: libraryCharges.createdAt, waiverReason: libraryCharges.waiverReason, waivedAt: libraryCharges.waivedAt })
    .from(libraryCharges)
    .where(and(eq(libraryCharges.tenantId, tenantId), eq(libraryCharges.memberId, member.id)))
    .orderBy(desc(libraryCharges.createdAt)).limit(100);
}

export async function cancelOwnHold(tenantId: string, userId: string, holdId: string, reason: string) {
  const member = await requireOwnMember(tenantId, userId);
  const [hold] = await db.select({ memberId: libraryHolds.memberId }).from(libraryHolds)
    .where(and(eq(libraryHolds.id, holdId), eq(libraryHolds.tenantId, tenantId))).limit(1);
  if (!hold) throw new ApiError(404, 'NOT_FOUND', 'Réservation introuvable.');
  if (hold.memberId !== member.id) throw new ApiError(403, 'NOT_OWN_HOLD', 'Cette réservation ne vous appartient pas.');
  return cancelHold(tenantId, userId, holdId, reason);
}

export async function renewOwnLoan(tenantId: string, userId: string, loanId: string, expectedRenewedCount?: number) {
  const member = await requireOwnMember(tenantId, userId);
  const [loan] = await db.select({ memberId: libraryLoans.memberId }).from(libraryLoans)
    .where(and(eq(libraryLoans.id, loanId), eq(libraryLoans.tenantId, tenantId))).limit(1);
  if (!loan) throw new ApiError(404, 'NOT_FOUND', 'Prêt introuvable.');
  if (loan.memberId !== member.id) throw new ApiError(403, 'NOT_OWN_LOAN', 'Ce prêt ne vous appartient pas.');
  return renewLoan(tenantId, userId, loanId, expectedRenewedCount);
}

// Guardian view of a child's library activity. Authorized only when an active
// guardianStudents relationship grants library access; the client supplies the
// child's user id, never a member id.
async function assertChildLibraryAccess(tenantId: string, guardianUserId: string, childUserId: string) {
  const [rel] = await db.select({ status: guardianStudents.status, canAccessLibrary: guardianStudents.canAccessLibrary })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
    .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardians.tenantId, tenantId), eq(guardians.userId, guardianUserId), eq(guardianStudents.studentId, childUserId)))
    .limit(1);
  if (!rel || rel.status !== 'active' || rel.canAccessLibrary !== true) {
    throw new ApiError(403, 'NO_GUARDIAN_LIBRARY_ACCESS', 'Accès bibliothèque non autorisé pour cet enfant.');
  }
}

export async function listAccessibleChildren(tenantId: string, guardianUserId: string) {
  return db.select({ studentId: guardianStudents.studentId, name: user.name, memberId: libraryMembers.id, memberNumber: libraryMembers.memberNumber, canAccessLibrary: guardianStudents.canAccessLibrary })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
    .innerJoin(user, eq(guardianStudents.studentId, user.id))
    .leftJoin(libraryMembers, and(eq(libraryMembers.userId, guardianStudents.studentId), eq(libraryMembers.tenantId, tenantId)))
    .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardians.tenantId, tenantId), eq(guardians.userId, guardianUserId), eq(guardianStudents.status, 'active'), eq(guardianStudents.canAccessLibrary, true), isNotNull(libraryMembers.id)))
    .orderBy(asc(user.name));
}

export async function listChildLoans(tenantId: string, guardianUserId: string, childUserId: string) {
  await assertChildLibraryAccess(tenantId, guardianUserId, childUserId);
  const [childMember] = await db.select({ id: libraryMembers.id }).from(libraryMembers)
    .where(and(eq(libraryMembers.tenantId, tenantId), eq(libraryMembers.userId, childUserId))).limit(1);
  if (!childMember) return [];
  return db.select({ id: libraryLoans.id, dueDate: libraryLoans.dueDate, returnedAt: libraryLoans.returnedAt, renewedCount: libraryLoans.renewedCount, copyId: libraryCopies.id, accessionNumber: libraryCopies.accessionNumber, title: libraryBibliographicRecords.title })
    .from(libraryLoans)
    .innerJoin(libraryCopies, eq(libraryLoans.copyId, libraryCopies.id))
    .innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id))
    .innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id))
    .where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.memberId, childMember.id)))
    .orderBy(desc(libraryLoans.issuedAt)).limit(100);
}
