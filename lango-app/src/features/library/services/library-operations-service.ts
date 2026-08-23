import { and, asc, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  branches, libraryBibliographicRecords, libraryChargeAdjustments, libraryCharges,
  libraryClosureDays, libraryCopies, libraryEditions, libraryHoldEvents, libraryHolds,
  libraryLoanEvents, libraryLoanPolicies, libraryLoans, libraryMembers, libraryStocktakeAdjustments,
  libraryStocktakeObservations, libraryStocktakes, libraryTransferEvents, libraryTransfers, user,
} from '@/models/Schema';

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

export async function listHolds(tenantId: string) {
  return db.select({ id: libraryHolds.id, state: libraryHolds.state, placedAt: libraryHolds.placedAt, expiresAt: libraryHolds.expiresAt, copyId: libraryCopies.id, accessionNumber: libraryCopies.accessionNumber, memberId: libraryMembers.id, memberNumber: libraryMembers.memberNumber, memberName: user.name })
    .from(libraryHolds).innerJoin(libraryCopies, eq(libraryHolds.copyId, libraryCopies.id)).innerJoin(libraryMembers, eq(libraryHolds.memberId, libraryMembers.id)).innerJoin(user, eq(libraryMembers.userId, user.id))
    .where(and(eq(libraryHolds.tenantId, tenantId), eq(libraryCopies.tenantId, tenantId), eq(libraryMembers.tenantId, tenantId))).orderBy(asc(libraryHolds.placedAt));
}

export async function placeHold(tenantId: string, actorId: string, copyId: string, memberId: string) {
  return db.transaction(async tx => {
    const [copy] = await tx.select({ id: libraryCopies.id, state: libraryCopies.state }).from(libraryCopies)
      .where(and(eq(libraryCopies.id, copyId), eq(libraryCopies.tenantId, tenantId))).for('update').limit(1);
    const [member] = await tx.select({ id: libraryMembers.id, state: libraryMembers.state, branchId: libraryMembers.branchId, role: user.role })
      .from(libraryMembers).innerJoin(user, eq(libraryMembers.userId, user.id))
      .where(and(eq(libraryMembers.id, memberId), eq(libraryMembers.tenantId, tenantId), eq(user.tenantId, tenantId))).limit(1);
    if (!copy || !member) throw new ApiError(422, 'INVALID_REFERENCE', 'Exemplaire ou adhérent introuvable.');
    if (member.state !== 'active') throw new ApiError(409, 'MEMBER_BLOCKED', 'Adhérent bloqué.');
    // A withdrawn/lost/missing copy is not reservable; checked-out copies are.
    if (copy.state === 'lost' || copy.state === 'withdrawn' || copy.state === 'missing' || copy.state === 'repair') {
      throw new ApiError(409, 'COPY_UNAVAILABLE', 'Exemplaire non réservable dans son état actuel.');
    }
    const [policy] = await tx.select().from(libraryLoanPolicies)
      .where(and(eq(libraryLoanPolicies.tenantId, tenantId), eq(libraryLoanPolicies.patronCategory, member.role), sql`(${libraryLoanPolicies.branchId} = ${member.branchId} OR ${libraryLoanPolicies.branchId} IS NULL)`))
      .orderBy(sql`case when ${libraryLoanPolicies.branchId} is null then 1 else 0 end`, asc(libraryLoanPolicies.branchId)).limit(1);
    if (policy) {
      const [activeHolds] = await tx.select({ n: sql<number>`count(*)::int` }).from(libraryHolds)
        .where(and(eq(libraryHolds.tenantId, tenantId), eq(libraryHolds.memberId, memberId), eq(libraryHolds.state, 'waiting')));
      if (Number(activeHolds?.n ?? 0) >= Number(policy.maxHolds ?? 0)) throw new ApiError(409, 'HOLD_LIMIT_REACHED', 'Limite de réservations atteinte.');
    }
    try {
      const [hold] = await tx.insert(libraryHolds).values({ tenantId, copyId, memberId, placedById: actorId }).returning();
      await tx.insert(libraryHoldEvents).values({ tenantId, holdId: hold!.id, eventType: 'placed', actorId });
      return hold!;
    } catch (error) {
      assertUniqueViolation(error, 'HOLD_EXISTS', 'Réservation déjà active.');
      throw error;
    }
  });
}

export async function cancelHold(tenantId: string, actorId: string, holdId: string, reason: string) {
  return db.transaction(async tx => {
    const [hold] = await tx.update(libraryHolds).set({ state: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: reason })
      .where(and(eq(libraryHolds.id, holdId), eq(libraryHolds.tenantId, tenantId), eq(libraryHolds.state, 'waiting'))).returning();
    if (!hold) throw new ApiError(409, 'HOLD_NOT_ACTIVE', 'Réservation non active.');
    await tx.insert(libraryHoldEvents).values({ tenantId, holdId, eventType: 'cancelled', actorId, note: reason }); return hold;
  });
}

export async function listPolicies(tenantId: string) { return db.select().from(libraryLoanPolicies).where(eq(libraryLoanPolicies.tenantId, tenantId)); }

// Policy CRUD — one policy per (tenant, category, branch) and one generic per
// (tenant, category). Duplicate prevention is a pre-check + the DB partial-unique
// indexes (migration 0101), which are the final arbiter under concurrency.
export async function createLoanPolicy(tenantId: string, input: {
  name: string; patronCategory: string; branchId?: string | null;
  maxLoans?: number; loanDurationDays?: number; renewalLimit?: number; renewalDurationDays?: number;
  finePerDay?: string; gracePeriodDays?: number; maxHolds?: number;
}) {
  if (input.branchId) {
    const [branch] = await db.select({ id: branches.id }).from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId))).limit(1);
    if (!branch) throw new ApiError(422, 'INVALID_REFERENCE', 'Succursale introuvable.');
  }
  try {
    const [row] = await db.insert(libraryLoanPolicies).values({ tenantId, ...input }).returning();
    return row!;
  } catch (error) {
    assertUniqueViolation(error, 'DUPLICATE_POLICY', 'Une politique existe déjà pour cette catégorie et cette succursale.');
    throw error;
  }
}

export async function updateLoanPolicy(tenantId: string, id: string, input: {
  name?: string; branchId?: string | null;
  maxLoans?: number; loanDurationDays?: number; renewalLimit?: number; renewalDurationDays?: number;
  finePerDay?: string; gracePeriodDays?: number; maxHolds?: number;
}) {
  if (input.branchId) {
    const [branch] = await db.select({ id: branches.id }).from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId))).limit(1);
    if (!branch) throw new ApiError(422, 'INVALID_REFERENCE', 'Succursale introuvable.');
  }
  try {
    const [row] = await db.update(libraryLoanPolicies).set({ ...input, updatedAt: new Date().toISOString() })
      .where(and(eq(libraryLoanPolicies.id, id), eq(libraryLoanPolicies.tenantId, tenantId))).returning();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Politique introuvable.');
    return row;
  } catch (error) {
    assertUniqueViolation(error, 'DUPLICATE_POLICY', 'Une politique existe déjà pour cette catégorie et cette succursale.');
    throw error;
  }
}

export async function deleteLoanPolicy(tenantId: string, id: string) {
  const [row] = await db.delete(libraryLoanPolicies)
    .where(and(eq(libraryLoanPolicies.id, id), eq(libraryLoanPolicies.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Politique introuvable.');
  return row;
}

// Branch closure calendar CRUD. A closure with branchId NULL closes the whole
// tenant; a scoped row closes one branch. Both partial-uniques (migration 0101).
export async function listClosureDays(tenantId: string, input: { branchId?: string; from?: string; to?: string } = {}) {
  const where = [eq(libraryClosureDays.tenantId, tenantId)];
  if (input.branchId) where.push(eq(libraryClosureDays.branchId, input.branchId));
  if (input.from) where.push(gte(libraryClosureDays.closedOn, input.from));
  if (input.to) where.push(lte(libraryClosureDays.closedOn, input.to));
  return db.select().from(libraryClosureDays).where(and(...where)).orderBy(desc(libraryClosureDays.closedOn));
}

export async function createClosureDay(tenantId: string, input: { closedOn: string; branchId?: string | null; reason?: string | null }) {
  if (input.branchId) {
    const [branch] = await db.select({ id: branches.id }).from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId))).limit(1);
    if (!branch) throw new ApiError(422, 'INVALID_REFERENCE', 'Succursale introuvable.');
  }
  try {
    const [row] = await db.insert(libraryClosureDays).values({ tenantId, ...input }).returning();
    return row!;
  } catch (error) {
    assertUniqueViolation(error, 'DUPLICATE_CLOSURE', 'Cette date de fermeture existe déjà.');
    throw error;
  }
}

export async function deleteClosureDay(tenantId: string, id: string) {
  const [row] = await db.delete(libraryClosureDays)
    .where(and(eq(libraryClosureDays.id, id), eq(libraryClosureDays.tenantId, tenantId))).returning();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Date de fermeture introuvable.');
  return row;
}

export async function listCharges(tenantId: string) { return db.select().from(libraryCharges).where(eq(libraryCharges.tenantId, tenantId)).orderBy(desc(libraryCharges.createdAt)); }

export async function waiveCharge(tenantId: string, actorId: string, chargeId: string, reason: string) {
  return db.transaction(async tx => {
    const [charge] = await tx.update(libraryCharges).set({ state: 'waived', waivedById: actorId, waivedAt: new Date().toISOString(), waiverReason: reason, updatedAt: new Date().toISOString() })
      .where(and(eq(libraryCharges.id, chargeId), eq(libraryCharges.tenantId, tenantId), eq(libraryCharges.state, 'open'))).returning();
    if (!charge) throw new ApiError(409, 'CHARGE_NOT_OPEN', 'Frais non ouvert.');
    await tx.insert(libraryChargeAdjustments).values({ tenantId, chargeId, adjustmentType: 'waive', amount: charge.amount, actorId, reason }); return charge;
  });
}

export async function listTransfers(tenantId: string) { return db.select().from(libraryTransfers).where(eq(libraryTransfers.tenantId, tenantId)).orderBy(desc(libraryTransfers.createdAt)); }

export async function createTransfer(tenantId: string, actorId: string, input: { copyId: string; toBranchId: string; note?: string | null }) {
  return db.transaction(async tx => {
    const [copy] = await tx.select().from(libraryCopies).where(and(eq(libraryCopies.id, input.copyId), eq(libraryCopies.tenantId, tenantId))).for('update').limit(1);
    const [target] = await tx.select({ id: branches.id }).from(branches).where(and(eq(branches.id, input.toBranchId), eq(branches.tenantId, tenantId))).limit(1);
    if (!copy || !target) throw new ApiError(422, 'INVALID_REFERENCE', 'Exemplaire ou succursale introuvable.');
    if (copy.branchId === input.toBranchId) throw new ApiError(422, 'SAME_BRANCH', 'Les succursales doivent être différentes.');
    if (copy.state !== 'available') throw new ApiError(409, 'COPY_UNAVAILABLE', 'Exemplaire non transférable.');
    const [transfer] = await tx.insert(libraryTransfers).values({ tenantId, copyId: copy.id, fromBranchId: copy.branchId, toBranchId: input.toBranchId, requestedById: actorId, note: input.note ?? null }).returning();
    await tx.insert(libraryTransferEvents).values({ tenantId, transferId: transfer!.id, eventType: 'requested', actorId, note: input.note ?? null }); return transfer!;
  });
}

export async function transitionTransfer(tenantId: string, actorId: string, transferId: string, action: 'dispatch' | 'receive' | 'cancel' | 'report_discrepancy') {
  return db.transaction(async tx => {
    const [row] = await tx.select().from(libraryTransfers).where(and(eq(libraryTransfers.id, transferId), eq(libraryTransfers.tenantId, tenantId))).for('update').limit(1);
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Transfert introuvable.');
    const now = new Date().toISOString();
    if (action === 'dispatch' && row.state === 'requested') {
      const [updated] = await tx.update(libraryTransfers).set({ state: 'dispatched', dispatchedAt: now, dispatchedById: actorId, updatedAt: now }).where(eq(libraryTransfers.id, row.id)).returning();
      await tx.update(libraryCopies).set({ state: 'in_transit', updatedAt: now }).where(and(eq(libraryCopies.id, row.copyId), eq(libraryCopies.tenantId, tenantId)));
      await tx.insert(libraryTransferEvents).values({ tenantId, transferId, eventType: 'dispatched', actorId }); return updated!;
    }
    // A receiving branch may flag a mismatch; the copy stays in transit.
    if (action === 'report_discrepancy' && row.state === 'dispatched') {
      const [updated] = await tx.update(libraryTransfers).set({ state: 'discrepancy', updatedAt: now }).where(eq(libraryTransfers.id, row.id)).returning();
      await tx.insert(libraryTransferEvents).values({ tenantId, transferId, eventType: 'discrepancy', actorId }); return updated!;
    }
    // Receive resolves both a normal delivery and a flagged discrepancy.
    if (action === 'receive' && (row.state === 'dispatched' || row.state === 'discrepancy')) {
      const [updated] = await tx.update(libraryTransfers).set({ state: 'received', receivedAt: now, receivedById: actorId, updatedAt: now }).where(eq(libraryTransfers.id, row.id)).returning();
      await tx.update(libraryCopies).set({ state: 'available', branchId: row.toBranchId, updatedAt: now }).where(and(eq(libraryCopies.id, row.copyId), eq(libraryCopies.tenantId, tenantId)));
      await tx.insert(libraryTransferEvents).values({ tenantId, transferId, eventType: 'received', actorId }); return updated!;
    }
    if (action === 'cancel' && row.state === 'requested') {
      const [updated] = await tx.update(libraryTransfers).set({ state: 'cancelled', updatedAt: now }).where(eq(libraryTransfers.id, row.id)).returning();
      await tx.insert(libraryTransferEvents).values({ tenantId, transferId, eventType: 'cancelled', actorId }); return updated!;
    }
    throw new ApiError(409, 'INVALID_TRANSFER_STATE', 'Transition de transfert invalide.');
  });
}

export async function listStocktakes(tenantId: string) { return db.select().from(libraryStocktakes).where(eq(libraryStocktakes.tenantId, tenantId)).orderBy(desc(libraryStocktakes.startedAt)); }
export async function startStocktake(tenantId: string, actorId: string, branchId: string) { const [branch] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId))).limit(1); if (!branch) throw new ApiError(422, 'INVALID_REFERENCE', 'Succursale introuvable.'); const [row] = await db.insert(libraryStocktakes).values({ tenantId, branchId, startedById: actorId }).returning(); return row!; }
export async function observeCopy(tenantId: string, actorId: string, stocktakeId: string, copyId: string, found: boolean, note?: string | null) {
  const [stocktake] = await db.select().from(libraryStocktakes).where(and(eq(libraryStocktakes.id, stocktakeId), eq(libraryStocktakes.tenantId, tenantId), eq(libraryStocktakes.state, 'open'))).limit(1);
  if (!stocktake) throw new ApiError(409, 'STOCKTAKE_NOT_OPEN', 'Inventaire non ouvert.');
  const [copy] = await db.select().from(libraryCopies).where(and(eq(libraryCopies.id, copyId), eq(libraryCopies.tenantId, tenantId))).limit(1);
  if (!copy || copy.branchId !== stocktake.branchId) throw new ApiError(422, 'INVALID_REFERENCE', 'Exemplaire invalide pour cet inventaire.');
  // Idempotent: one observation per copy per stocktake (unique stocktake_id+copy_id).
  const [row] = await db.insert(libraryStocktakeObservations).values({ tenantId, stocktakeId, copyId, countedById: actorId, found, note: note ?? null })
    .onConflictDoUpdate({ target: [libraryStocktakeObservations.stocktakeId, libraryStocktakeObservations.copyId], set: { found, countedById: actorId, note: note ?? null } }).returning();
  return row!;
}

export async function closeStocktake(tenantId: string, actorId: string, id: string) {
  return db.transaction(async tx => {
    const [stocktake] = await tx.select().from(libraryStocktakes).where(and(eq(libraryStocktakes.id, id), eq(libraryStocktakes.tenantId, tenantId), eq(libraryStocktakes.state, 'open'))).for('update').limit(1);
    if (!stocktake) throw new ApiError(409, 'STOCKTAKE_NOT_OPEN', 'Inventaire non ouvert.');
    const [branchCopies, observations] = await Promise.all([
      tx.select().from(libraryCopies).where(and(eq(libraryCopies.tenantId, tenantId), eq(libraryCopies.branchId, stocktake.branchId))),
      tx.select().from(libraryStocktakeObservations).where(and(eq(libraryStocktakeObservations.tenantId, tenantId), eq(libraryStocktakeObservations.stocktakeId, stocktake.id))),
    ]);
    const obsByCopy = new Map(observations.map(o => [o.copyId, o]));
    const now = new Date().toISOString();
    let adjustmentsCreated = 0;
    let uncounted = 0;
    // Reconcile: only available copies expected on the shelf are flagged. A copy
    // observed found=false becomes a pending adjustment to 'missing'; an available
    // copy never scanned is reported as uncounted (no observation row to trace).
    for (const copy of branchCopies) {
      if (copy.state !== 'available') continue;
      const obs = obsByCopy.get(copy.id);
      if (!obs) { uncounted += 1; continue; }
      if (obs.found === false) {
        await tx.insert(libraryStocktakeAdjustments).values({ tenantId, stocktakeId: stocktake.id, observationId: obs.id, copyId: copy.id, fromState: 'available', toState: 'missing', resolvedById: actorId, reason: obs.note ?? "Exemplaire non trouvé lors de l'inventaire." }).onConflictDoNothing();
        adjustmentsCreated += 1;
      }
    }
    const [row] = await tx.update(libraryStocktakes).set({ state: 'closed', closedAt: now, closedById: actorId }).where(eq(libraryStocktakes.id, stocktake.id)).returning();
    return { ...row!, adjustmentsCreated, uncounted };
  });
}

export async function listStocktakeAdjustments(tenantId: string, stocktakeId: string) {
  return db.select().from(libraryStocktakeAdjustments).where(and(eq(libraryStocktakeAdjustments.tenantId, tenantId), eq(libraryStocktakeAdjustments.stocktakeId, stocktakeId)));
}

export async function applyStocktakeAdjustments(tenantId: string, actorId: string, stocktakeId: string) {
  return db.transaction(async tx => {
    const pending = await tx.select().from(libraryStocktakeAdjustments)
      .where(and(eq(libraryStocktakeAdjustments.tenantId, tenantId), eq(libraryStocktakeAdjustments.stocktakeId, stocktakeId), isNull(libraryStocktakeAdjustments.appliedAt))).for('update');
    const now = new Date().toISOString();
    for (const adj of pending) {
      await tx.update(libraryCopies).set({ state: adj.toState, updatedAt: now }).where(and(eq(libraryCopies.id, adj.copyId), eq(libraryCopies.tenantId, tenantId)));
      await tx.update(libraryStocktakeAdjustments).set({ appliedAt: now }).where(eq(libraryStocktakeAdjustments.id, adj.id));
    }
    return pending;
  });
}

export async function overdueReport(tenantId: string) { const today = new Date().toISOString().slice(0, 10); return db.select({ loanId: libraryLoans.id, dueDate: libraryLoans.dueDate, memberNumber: libraryMembers.memberNumber, memberName: user.name, accessionNumber: libraryCopies.accessionNumber, title: libraryBibliographicRecords.title }).from(libraryLoans).innerJoin(libraryMembers, eq(libraryLoans.memberId, libraryMembers.id)).innerJoin(user, eq(libraryMembers.userId, user.id)).innerJoin(libraryCopies, eq(libraryLoans.copyId, libraryCopies.id)).innerJoin(libraryEditions, eq(libraryCopies.editionId, libraryEditions.id)).innerJoin(libraryBibliographicRecords, eq(libraryEditions.recordId, libraryBibliographicRecords.id)).where(and(eq(libraryLoans.tenantId, tenantId), isNull(libraryLoans.returnedAt), sql`${libraryLoans.dueDate} < ${today}`)).orderBy(asc(libraryLoans.dueDate)); }

const COPY_STATE_KEYS = ['available', 'on_hold_shelf', 'checked_out', 'in_transit', 'repair', 'lost', 'missing', 'withdrawn'] as const;

export async function inventoryReport(tenantId: string) {
  const [branchRows, stateRows, conditionRows] = await Promise.all([
    db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.tenantId, tenantId)).orderBy(asc(branches.name)),
    db.select({ branchId: libraryCopies.branchId, state: libraryCopies.state, n: sql<number>`count(*)::int` }).from(libraryCopies).where(eq(libraryCopies.tenantId, tenantId)).groupBy(libraryCopies.branchId, libraryCopies.state),
    db.select({ branchId: libraryCopies.branchId, condition: libraryCopies.condition, n: sql<number>`count(*)::int` }).from(libraryCopies).where(eq(libraryCopies.tenantId, tenantId)).groupBy(libraryCopies.branchId, libraryCopies.condition),
  ]);
  const byBranch = branchRows.map(branch => {
    const counts: Record<string, number> = {};
    for (const key of COPY_STATE_KEYS) counts[key] = 0;
    for (const row of stateRows) if (row.branchId === branch.id && row.state && counts[row.state] !== undefined) counts[row.state] = Number(row.n);
    const conditions: Record<string, number> = {};
    for (const row of conditionRows) if (row.branchId === branch.id && row.condition) conditions[row.condition] = Number(row.n);
    const total = COPY_STATE_KEYS.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
    return {
      branchId: branch.id, branchName: branch.name, conditions, total,
      available: counts.available ?? 0, checkedOut: counts.checked_out ?? 0, onHoldShelf: counts.on_hold_shelf ?? 0,
      inTransit: counts.in_transit ?? 0, repair: counts.repair ?? 0, lost: counts.lost ?? 0, missing: counts.missing ?? 0, withdrawn: counts.withdrawn ?? 0,
      active: total - (counts.withdrawn ?? 0),
    };
  });
  const totals = byBranch.reduce((acc, b) => ({ total: acc.total + b.total, active: acc.active + b.active, withdrawn: acc.withdrawn + b.withdrawn }), { total: 0, active: 0, withdrawn: 0 });
  return { byBranch, totals };
}

export async function circulationReport(tenantId: string) {
  const cutoff30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const cutoff90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [issued30, returned30, renewed30, issued90, returned90, renewed90, active, holdRows, transferRows, chargeRows, issuedDaily, returnedDaily, renewedDaily] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), gte(libraryLoans.issuedAt, cutoff30))),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), gte(libraryLoans.returnedAt, cutoff30))),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoanEvents).where(and(eq(libraryLoanEvents.tenantId, tenantId), eq(libraryLoanEvents.eventType, 'renewed'), gte(libraryLoanEvents.at, cutoff30))),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), gte(libraryLoans.issuedAt, cutoff90))),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), gte(libraryLoans.returnedAt, cutoff90))),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoanEvents).where(and(eq(libraryLoanEvents.tenantId, tenantId), eq(libraryLoanEvents.eventType, 'renewed'), gte(libraryLoanEvents.at, cutoff90))),
    db.select({ n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), isNull(libraryLoans.returnedAt))),
    db.select({ state: libraryHolds.state, n: sql<number>`count(*)::int` }).from(libraryHolds).where(eq(libraryHolds.tenantId, tenantId)).groupBy(libraryHolds.state),
    db.select({ state: libraryTransfers.state, n: sql<number>`count(*)::int` }).from(libraryTransfers).where(eq(libraryTransfers.tenantId, tenantId)).groupBy(libraryTransfers.state),
    db.select({ state: libraryCharges.state, n: sql<number>`count(*)::int`, amount: sql<number>`sum(${libraryCharges.amount})::float8` }).from(libraryCharges).where(eq(libraryCharges.tenantId, tenantId)).groupBy(libraryCharges.state),
    db.select({ day: sql<string>`to_char(${libraryLoans.issuedAt}, 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), gte(libraryLoans.issuedAt, cutoff30))).groupBy(sql`to_char(${libraryLoans.issuedAt}, 'YYYY-MM-DD')`),
    db.select({ day: sql<string>`to_char(${libraryLoans.returnedAt}, 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` }).from(libraryLoans).where(and(eq(libraryLoans.tenantId, tenantId), gte(libraryLoans.returnedAt, cutoff30))).groupBy(sql`to_char(${libraryLoans.returnedAt}, 'YYYY-MM-DD')`),
    db.select({ day: sql<string>`to_char(${libraryLoanEvents.at}, 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` }).from(libraryLoanEvents).where(and(eq(libraryLoanEvents.tenantId, tenantId), eq(libraryLoanEvents.eventType, 'renewed'), gte(libraryLoanEvents.at, cutoff30))).groupBy(sql`to_char(${libraryLoanEvents.at}, 'YYYY-MM-DD')`),
  ]);
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  const toMap = (rows: Array<{ day: string; n: number }>) => new Map(rows.map(r => [r.day, Number(r.n)]));
  const issuedMap = toMap(issuedDaily);
  const returnedMap = toMap(returnedDaily);
  const renewedMap = toMap(renewedDaily);
  const daily = days.map(day => ({ day, issued: issuedMap.get(day) ?? 0, returned: returnedMap.get(day) ?? 0, renewed: renewedMap.get(day) ?? 0 }));
  const holdCounts = { waiting: 0, fulfilled: 0, cancelled: 0, expired: 0 };
  for (const r of holdRows) if (r.state && r.state in holdCounts) holdCounts[r.state as keyof typeof holdCounts] = Number(r.n);
  const transferCounts = { requested: 0, dispatched: 0, received: 0, discrepancy: 0, cancelled: 0 };
  for (const r of transferRows) if (r.state && r.state in transferCounts) transferCounts[r.state as keyof typeof transferCounts] = Number(r.n);
  const chargeCounts = { open: 0, waived: 0, posted: 0 };
  let openAmount = 0;
  for (const r of chargeRows) { if (r.state && r.state in chargeCounts) chargeCounts[r.state as keyof typeof chargeCounts] = Number(r.n); if (r.state === 'open') openAmount = Number(r.amount ?? 0); }
  return {
    loans: {
      active: Number(active?.[0]?.n ?? 0), issued30: Number(issued30?.[0]?.n ?? 0), returned30: Number(returned30?.[0]?.n ?? 0), renewed30: Number(renewed30?.[0]?.n ?? 0),
      issued90: Number(issued90?.[0]?.n ?? 0), returned90: Number(returned90?.[0]?.n ?? 0), renewed90: Number(renewed90?.[0]?.n ?? 0), daily,
    },
    holds: holdCounts,
    transfers: transferCounts,
    charges: { open: chargeCounts.open, waived: chargeCounts.waived, paid: chargeCounts.posted, openAmount },
  };
}
