// Allocation lifecycle service — the source of truth for hostel occupancy.
// Occupancy is derived from effective-dated allocations; the DB EXCLUDE
// constraints (migration 0076) are the concurrency backstop, and every insert
// that can trip them maps SQLSTATE 23P01 to a 409 ALLOCATION_CONFLICT here.
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { sessionYears, user } from '@/models/Schema';
import {
  hostelAllocationEvents,
  hostelAllocations,
  hostelApplications,
  hostelBeds,
  hostelRooms,
  hostelRoomCategories,
} from '@/features/hostel/models/hostel-schema';
import { dateString } from '@/features/hostel/services/inventory-service';
import { getStudentContext, evaluateBedEligibility } from '@/features/hostel/services/eligibility-service';
import { resolveCandidateBeds } from '@/features/hostel/server/placement-resolver';
import { emitCharge, recordSimulatedFinanceFailure, FinanceUnavailableError } from '@/features/hostel/server/finance-adapter';
import { firstRow } from '@/features/hostel/server/db-utils';

// ---------------------------------------------------------------------------
// 23P01 mapping (EXCLUDE USING gist violation) — not covered by apiErrorResponse
// ---------------------------------------------------------------------------

function isExclusionViolation(error: unknown): boolean {
  for (const candidate of [error, (error as { cause?: unknown } | null)?.cause]) {
    if (typeof candidate === 'object' && candidate !== null && 'code' in candidate) {
      const code = (candidate as { code: unknown }).code;
      if (code === '23P01') return true;
      if (code === '23505') return true; // defensive: unique index races
    }
  }
  return false;
}

function conflict(message: string): never {
  throw new ApiError(409, 'ALLOCATION_CONFLICT', message);
}

function addDaysString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

async function loadActiveAllocation(tenantId: string, allocationId: string) {
  const [allocation] = await db.select().from(hostelAllocations)
    .where(and(eq(hostelAllocations.id, allocationId), eq(hostelAllocations.tenantId, tenantId))).limit(1);
  if (!allocation) throw new ApiError(404, 'NOT_FOUND', 'Affectation introuvable.');
  return allocation;
}

async function chargeSnapshotForBed(tenantId: string, bedId: string) {
  const [bed] = await db.select().from(hostelBeds)
    .where(and(eq(hostelBeds.id, bedId), eq(hostelBeds.tenantId, tenantId))).limit(1);
  if (!bed) return null;
  const [room] = await db.select().from(hostelRooms)
    .where(and(eq(hostelRooms.id, bed.roomId), eq(hostelRooms.tenantId, tenantId))).limit(1);
  if (!room) return null;
  const [category] = room.categoryId
    ? await db.select().from(hostelRoomCategories)
        .where(and(eq(hostelRoomCategories.id, room.categoryId), eq(hostelRoomCategories.tenantId, tenantId))).limit(1)
    : [null];
  return category ? {
    categoryId: category.id,
    categoryCode: category.code,
    baseCharge: category.baseCharge,
    depositAmount: category.depositAmount,
    capturedAt: new Date().toISOString(),
  } : null;
}

async function recordEvent(tenantId: string, allocationId: string, eventType: string, actorId: string, opts: {
  reason?: string | null;
  metadata?: unknown;
} = {}) {
  await db.insert(hostelAllocationEvents).values({
    tenantId,
    allocationId,
    eventType,
    actorId,
    reason: opts.reason ?? null,
    metadata: opts.metadata ?? null,
  });
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export async function listApplications(tenantId: string, opts?: {
  studentId?: string | null;
  sessionYearId?: string | null;
  decision?: string | null;
}) {
  const conds = [eq(hostelApplications.tenantId, tenantId)];
  if (opts?.studentId) conds.push(eq(hostelApplications.studentId, opts.studentId));
  if (opts?.sessionYearId) conds.push(eq(hostelApplications.sessionYearId, opts.sessionYearId));
  if (opts?.decision) conds.push(eq(hostelApplications.decision, opts.decision));

  return db
    .select({
      id: hostelApplications.id,
      studentId: hostelApplications.studentId,
      studentName: user.name,
      sessionYearId: hostelApplications.sessionYearId,
      requestedStartDate: hostelApplications.requestedStartDate,
      requestedEndDate: hostelApplications.requestedEndDate,
      preferredCategoryIds: hostelApplications.preferredCategoryIds,
      preferredRoomId: hostelApplications.preferredRoomId,
      priorityReason: hostelApplications.priorityReason,
      guardianConsentStatus: hostelApplications.guardianConsentStatus,
      decision: hostelApplications.decision,
      decisionReason: hostelApplications.decisionReason,
      decidedById: hostelApplications.decidedById,
      decidedAt: hostelApplications.decidedAt,
      createdAt: hostelApplications.createdAt,
      updatedAt: hostelApplications.updatedAt,
    })
    .from(hostelApplications)
    .leftJoin(user, eq(hostelApplications.studentId, user.id))
    .where(and(...conds))
    .orderBy(desc(hostelApplications.createdAt));
}

async function validateApplicationReferences(tenantId: string, opts: {
  sessionYearId?: string | null;
  preferredRoomId?: string | null;
  preferredCategoryIds?: string[] | null;
}) {
  if (opts.sessionYearId) {
    const [yr] = await db.select({ id: sessionYears.id }).from(sessionYears)
      .where(and(eq(sessionYears.id, opts.sessionYearId), eq(sessionYears.tenantId, tenantId))).limit(1);
    if (!yr) throw new ApiError(422, 'INVALID_SESSION_YEAR', 'Année scolaire invalide pour cet établissement.');
  }
  if (opts.preferredRoomId) {
    const [room] = await db.select({ id: hostelRooms.id }).from(hostelRooms)
      .where(and(eq(hostelRooms.id, opts.preferredRoomId), eq(hostelRooms.tenantId, tenantId))).limit(1);
    if (!room) throw new ApiError(422, 'INVALID_ROOM', 'Chambre préférée invalide pour cet établissement.');
  }
  if (opts.preferredCategoryIds && opts.preferredCategoryIds.length > 0) {
    const unique = [...new Set(opts.preferredCategoryIds)];
    const cats = await db.select({ id: hostelRoomCategories.id }).from(hostelRoomCategories)
      .where(and(eq(hostelRoomCategories.tenantId, tenantId), inArray(hostelRoomCategories.id, unique)));
    if (cats.length !== unique.length) {
      throw new ApiError(422, 'INVALID_CATEGORY', 'Une catégorie préférée est invalide pour cet établissement.');
    }
  }
}

export async function createApplication(tenantId: string, actorId: string, opts: {
  studentId: string;
  sessionYearId?: string | null;
  requestedStartDate: string;
  requestedEndDate: string;
  preferredCategoryIds?: string[] | null;
  preferredRoomId?: string | null;
  priorityReason?: string | null;
  guardianConsentStatus?: string;
}) {
  await getStudentContext(tenantId, opts.studentId);
  await validateApplicationReferences(tenantId, opts);
  const row = firstRow(await db.insert(hostelApplications).values({
    tenantId,
    studentId: opts.studentId,
    sessionYearId: opts.sessionYearId ?? null,
    requestedStartDate: opts.requestedStartDate,
    requestedEndDate: opts.requestedEndDate,
    preferredCategoryIds: opts.preferredCategoryIds ?? null,
    preferredRoomId: opts.preferredRoomId ?? null,
    priorityReason: opts.priorityReason ?? null,
    guardianConsentStatus: opts.guardianConsentStatus ?? 'not_required',
  }).returning());
  return row;
}

export async function getApplication(tenantId: string, applicationId: string) {
  const [row] = await db
    .select({
      id: hostelApplications.id,
      studentId: hostelApplications.studentId,
      studentName: user.name,
      sessionYearId: hostelApplications.sessionYearId,
      requestedStartDate: hostelApplications.requestedStartDate,
      requestedEndDate: hostelApplications.requestedEndDate,
      preferredCategoryIds: hostelApplications.preferredCategoryIds,
      preferredRoomId: hostelApplications.preferredRoomId,
      priorityReason: hostelApplications.priorityReason,
      guardianConsentStatus: hostelApplications.guardianConsentStatus,
      decision: hostelApplications.decision,
      decisionReason: hostelApplications.decisionReason,
      decidedById: hostelApplications.decidedById,
      decidedAt: hostelApplications.decidedAt,
      createdAt: hostelApplications.createdAt,
      updatedAt: hostelApplications.updatedAt,
    })
    .from(hostelApplications)
    .leftJoin(user, eq(hostelApplications.studentId, user.id))
    .where(and(eq(hostelApplications.id, applicationId), eq(hostelApplications.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Demande introuvable.');
  return row;
}

export async function updateApplication(tenantId: string, applicationId: string, actorId: string, opts: {
  guardianConsentStatus?: string;
  preferredCategoryIds?: string[] | null;
  preferredRoomId?: string | null;
  priorityReason?: string | null;
}) {
  const [application] = await db.select({ id: hostelApplications.id }).from(hostelApplications)
    .where(and(eq(hostelApplications.id, applicationId), eq(hostelApplications.tenantId, tenantId))).limit(1);
  if (!application) throw new ApiError(404, 'NOT_FOUND', 'Demande introuvable.');
  await validateApplicationReferences(tenantId, opts);
  const row = firstRow(await db.update(hostelApplications)
    .set({
      ...(opts.guardianConsentStatus !== undefined ? { guardianConsentStatus: opts.guardianConsentStatus } : {}),
      ...(opts.preferredCategoryIds !== undefined ? { preferredCategoryIds: opts.preferredCategoryIds } : {}),
      ...(opts.preferredRoomId !== undefined ? { preferredRoomId: opts.preferredRoomId } : {}),
      ...(opts.priorityReason !== undefined ? { priorityReason: opts.priorityReason } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(hostelApplications.id, applicationId), eq(hostelApplications.tenantId, tenantId)))
    .returning());
  return row;
}

export async function decideApplication(tenantId: string, applicationId: string, actorId: string, opts: {
  decision: 'approved' | 'denied' | 'waitlisted' | 'withdrawn';
  decisionReason?: string | null;
}) {
  const [application] = await db.select().from(hostelApplications)
    .where(and(eq(hostelApplications.id, applicationId), eq(hostelApplications.tenantId, tenantId))).limit(1);
  if (!application) throw new ApiError(404, 'NOT_FOUND', 'Demande introuvable.');
  const row = firstRow(await db.update(hostelApplications)
    .set({
      decision: opts.decision,
      decisionReason: opts.decisionReason ?? null,
      decidedById: actorId,
      decidedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(hostelApplications.id, applicationId), eq(hostelApplications.tenantId, tenantId)))
    .returning());
  return row;
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export async function previewAllocation(tenantId: string, opts: {
  studentId: string;
  bedId: string;
  startDate: string;
  endDate: string;
}) {
  const result = await evaluateBedEligibility(tenantId, opts);
  return { bedId: opts.bedId, studentId: opts.studentId, ...result };
}

export async function previewStudentPlacement(tenantId: string, opts: {
  studentId: string;
  startDate: string;
  endDate: string;
  hostelId?: string | null;
  categoryIds?: string[] | null;
  roomId?: string | null;
}) {
  return resolveCandidateBeds(tenantId, opts);
}

export async function previewBulk(tenantId: string, rows: Array<{
  studentId: string;
  bedId: string;
  startDate: string;
  endDate: string;
}>) {
  return Promise.all(rows.map(r => previewAllocation(tenantId, r)));
}

// ---------------------------------------------------------------------------
// Commit (single reservation)
// ---------------------------------------------------------------------------

export async function commitAllocation(tenantId: string, actorId: string, opts: {
  applicationId?: string | null;
  studentId: string;
  bedId: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  notes?: string | null;
}) {
  await getStudentContext(tenantId, opts.studentId);

  // Consent + binding gates: an application must be approved, consent cleared,
  // and it must belong to this student with a date window that contains the
  // allocation before a commitment is allowed.
  if (opts.applicationId) {
    const [application] = await db.select().from(hostelApplications)
      .where(and(eq(hostelApplications.id, opts.applicationId), eq(hostelApplications.tenantId, tenantId))).limit(1);
    if (!application) throw new ApiError(422, 'INVALID_APPLICATION', 'Demande introuvable.');
    if (application.decision !== 'approved') {
      throw new ApiError(409, 'APPLICATION_NOT_APPROVED', 'La demande doit être approuvée avant de créer l\'affectation.');
    }
    if (application.guardianConsentStatus === 'required') {
      throw new ApiError(409, 'ALLOCATION_CONSENT_REQUIRED',
        'Le consentement du tuteur est requis et n\'a pas encore été approuvé.');
    }
    if (application.guardianConsentStatus === 'denied') {
      throw new ApiError(409, 'ALLOCATION_CONSENT_DENIED',
        'Le tuteur a refusé le consentement pour cet internat.');
    }
    if (application.studentId !== opts.studentId) {
      throw new ApiError(422, 'APPLICATION_STUDENT_MISMATCH',
        'La demande sélectionnée ne correspond pas à cet élève.');
    }
    if (opts.effectiveStartDate < application.requestedStartDate
      || opts.effectiveEndDate > application.requestedEndDate) {
      throw new ApiError(422, 'APPLICATION_DATE_MISMATCH',
        `La période d'affectation doit rester dans la période demandée (${application.requestedStartDate} → ${application.requestedEndDate}).`);
    }
  }

  const snapshot = await chargeSnapshotForBed(tenantId, opts.bedId);
  if (!snapshot) throw new ApiError(422, 'INVALID_BED', 'Le lit choisi n\'existe pas dans cet établissement.');

  try {
    return await db.transaction(async (tx) => {
      const allocation = firstRow(await tx.insert(hostelAllocations).values({
        tenantId,
        applicationId: opts.applicationId ?? null,
        studentId: opts.studentId,
        bedId: opts.bedId,
        effectiveStartDate: opts.effectiveStartDate,
        effectiveEndDate: opts.effectiveEndDate,
        state: 'reserved',
        chargeSnapshot: snapshot,
        notes: opts.notes ?? null,
      }).returning());
      await tx.insert(hostelAllocationEvents).values({
        tenantId,
        allocationId: allocation.id,
        eventType: 'reserved',
        actorId,
        metadata: { effectiveStartDate: opts.effectiveStartDate, effectiveEndDate: opts.effectiveEndDate, bedId: opts.bedId },
      });
      return allocation;
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      conflict('Conflit d\'affectation : ce lit ou cet élève a déjà une affectation active sur la période demandée.');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Bulk commit (one transaction — all or nothing)
// ---------------------------------------------------------------------------

export async function bulkCommitAllocations(tenantId: string, actorId: string, rows: Array<{
  studentId: string;
  bedId: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  notes?: string | null;
}>) {
  if (rows.length === 0) throw new ApiError(422, 'VALIDATION_ERROR', 'Aucune affectation à créer.');
  try {
    return await db.transaction(async (tx) => {
      const created = [];
      for (const row of rows) {
        // Tenant-validate the student before any write (throws ApiError 422 for
        // cross-tenant or unknown students, aborting the whole batch).
        await getStudentContext(tenantId, row.studentId);
        const snapshot = await chargeSnapshotForBed(tenantId, row.bedId);
        if (!snapshot) throw new ApiError(422, 'INVALID_BED', 'Un des lits choisis n\'existe pas.');
        const allocation = firstRow(await tx.insert(hostelAllocations).values({
          tenantId,
          studentId: row.studentId,
          bedId: row.bedId,
          effectiveStartDate: row.effectiveStartDate,
          effectiveEndDate: row.effectiveEndDate,
          state: 'reserved',
          chargeSnapshot: snapshot,
          notes: row.notes ?? null,
        }).returning());
        await tx.insert(hostelAllocationEvents).values({
          tenantId,
          allocationId: allocation.id,
          eventType: 'reserved',
          actorId,
          metadata: { bedId: row.bedId, effectiveStartDate: row.effectiveStartDate, effectiveEndDate: row.effectiveEndDate },
        });
        created.push(allocation);
      }
      return created;
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      conflict('Conflit d\'affectation dans le lot : un lit ou élève a déjà une affectation active sur la période.');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Check-in / check-out
// ---------------------------------------------------------------------------

export async function checkInAllocation(tenantId: string, actorId: string, allocationId: string) {
  const today = dateString();
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx.update(hostelAllocations)
      .set({ state: 'checked_in', checkedInAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(and(
        eq(hostelAllocations.id, allocationId),
        eq(hostelAllocations.tenantId, tenantId),
        eq(hostelAllocations.state, 'reserved'),
        sql`${hostelAllocations.effectiveStartDate} <= ${today}::date`,
      ))
      .returning();
    if (row) {
      await tx.insert(hostelAllocationEvents).values({
        tenantId,
        allocationId,
        eventType: 'checked_in',
        actorId,
        metadata: { checkedInAt: row.checkedInAt },
      });
    }
    return row ?? null;
  });

  if (claimed) return claimed;

  // No row claimed: reconcile from current state (idempotent retry or invalid state).
  const current = await loadActiveAllocation(tenantId, allocationId);
  if (current.state === 'checked_in') return current; // already checked in
  if (current.state === 'reserved' && current.effectiveStartDate > today) {
    throw new ApiError(409, 'STAY_NOT_STARTED',
      `L'affectation commence le ${current.effectiveStartDate}; l'arrivée ne peut pas être anticipée.`);
  }
  throw new ApiError(409, 'INVALID_STATE', 'Seule une affectation réservée peut être enregistrée comme arrivée.');
}

export async function checkOutAllocation(tenantId: string, actorId: string, allocationId: string, opts: {
  simulateFinanceFailure?: boolean;
} = {}) {
  const today = dateString();

  // Atomic claim: the conditional UPDATE `... AND state='checked_in'` guarantees
  // exactly one concurrent caller wins the departure; the loser's update affects
  // 0 rows and never reaches the finance post. End date uses a same-day-safe
  // computation so `effective_end_date > effective_start_date` (CHECK) holds
  // even when a student checks out the day they arrived.
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx.update(hostelAllocations)
      .set({
        state: 'checked_out',
        checkedOutAt: new Date().toISOString(),
        effectiveEndDate: sql`CASE WHEN ${hostelAllocations.effectiveStartDate} < ${today}::date
          THEN ${today}::date
          ELSE ${hostelAllocations.effectiveStartDate} + 1 END`,
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        eq(hostelAllocations.id, allocationId),
        eq(hostelAllocations.tenantId, tenantId),
        eq(hostelAllocations.state, 'checked_in'),
      ))
      .returning();
    if (row) {
      await tx.insert(hostelAllocationEvents).values({
        tenantId,
        allocationId,
        eventType: 'checked_out',
        actorId,
        metadata: { checkedOutAt: row.checkedOutAt, effectiveEndDate: row.effectiveEndDate },
      });
    }
    return row ?? null;
  });

  if (!claimed) {
    // No row claimed: idempotent retry on an already-checked-out allocation.
    const current = await loadActiveAllocation(tenantId, allocationId);
    if (current.state === 'checked_out') return current;
    throw new ApiError(409, 'INVALID_STATE', 'Seule une affectation active (arrivée enregistrée) peut être clôturée.');
  }

  // Finance posting AFTER the claim, best-effort: only the winner posts, and a
  // Finance failure must never block a departure (emergency checkout guarantee).
  const snapshot = (claimed.chargeSnapshot ?? {}) as { baseCharge?: string };
  const amount = snapshot.baseCharge ?? '0';
  if (opts.simulateFinanceFailure) {
    await recordSimulatedFinanceFailure(tenantId, {
      allocationId,
      chargeType: 'residence_fee',
      amount,
    }).catch(() => undefined);
  } else {
    try {
      await emitCharge(tenantId, {
        allocationId,
        studentId: claimed.studentId,
        chargeType: 'residence_fee',
        amount,
        description: `Pension résidence ${today}`,
      });
    } catch (error) {
      if (!(error instanceof FinanceUnavailableError)) throw error;
      // Finance down: the link is already marked 'failed'; departure proceeds.
    }
  }

  return claimed;
}

// ---------------------------------------------------------------------------
// Transfer (atomic: close source + open destination)
// ---------------------------------------------------------------------------

export async function transferAllocation(tenantId: string, actorId: string, sourceAllocationId: string, opts: {
  targetBedId: string;
  effectiveDate: string;
  reason?: string | null;
}) {
  const source = await loadActiveAllocation(tenantId, sourceAllocationId);
  if (source.state !== 'reserved' && source.state !== 'checked_in') {
    throw new ApiError(409, 'INVALID_STATE', 'Seule une affectation réservée ou active peut être transférée.');
  }
  if (opts.effectiveDate < source.effectiveStartDate || opts.effectiveDate >= source.effectiveEndDate) {
    throw new ApiError(409, 'INVALID_TRANSFER_DATE',
      'La date de transfert doit se situer dans la période de l\'affectation source.');
  }

  // Eligibility of the target bed for this student over the remaining window.
  // `excludeAllocationId: source.id` keeps the source allocation (same student,
  // overlapping range on the old bed) from blocking its own transfer.
  const eligibility = await evaluateBedEligibility(tenantId, {
    bedId: opts.targetBedId,
    studentId: source.studentId,
    startDate: opts.effectiveDate,
    endDate: source.effectiveEndDate,
    excludeAllocationId: source.id,
  });
  if (!eligibility.eligible) {
    throw new ApiError(409, 'TRANSFER_BLOCKED',
      `Transfert impossible : ${eligibility.reasons.join(' ')}`);
  }

  try {
    return await db.transaction(async (tx) => {
      // Lock the source row: serializes concurrent transfers/checkouts of the
      // same allocation. Re-read + re-validate state under the lock.
      const [locked] = await tx.select().from(hostelAllocations)
        .where(eq(hostelAllocations.id, source.id))
        .for('update')
        .limit(1);
      if (!locked) throw new ApiError(404, 'NOT_FOUND', 'Affectation source introuvable.');
      if (locked.state !== 'reserved' && locked.state !== 'checked_in') {
        throw new ApiError(409, 'INVALID_STATE',
          'L\'affectation source n\'est plus transférable (état modifié entre-temps).');
      }

      const wasCheckedIn = locked.state === 'checked_in';
      const targetState = wasCheckedIn ? 'checked_in' : 'reserved';

      // Close source (checked_out if it was active, cancelled if only reserved).
      // Same-day-safe end: when the transfer day equals the source start date,
      // bump to start+1 so `effective_end_date > effective_start_date` (CHECK)
      // holds — identical to how check-out closes a same-day arrival.
      const closedState = wasCheckedIn ? 'checked_out' : 'cancelled';
      const closedEnd = locked.effectiveStartDate < opts.effectiveDate
        ? opts.effectiveDate
        : addDaysString(locked.effectiveStartDate, 1);
      await tx.update(hostelAllocations)
        .set({
          state: closedState,
          ...(wasCheckedIn ? { checkedOutAt: new Date().toISOString() } : {}),
          effectiveEndDate: closedEnd,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(hostelAllocations.id, source.id));

      // Open destination, abutting the source range ([start, date) + [date, end)).
      const destination = firstRow(await tx.insert(hostelAllocations).values({
        tenantId,
        applicationId: locked.applicationId,
        studentId: locked.studentId,
        bedId: opts.targetBedId,
        effectiveStartDate: opts.effectiveDate,
        effectiveEndDate: locked.effectiveEndDate,
        state: targetState,
        chargeSnapshot: locked.chargeSnapshot,
        sourceAllocationId: locked.id,
        ...(wasCheckedIn ? { checkedInAt: locked.checkedInAt } : {}),
      }).returning());

      await tx.insert(hostelAllocationEvents).values({
        tenantId,
        allocationId: locked.id,
        eventType: 'transferred_out',
        actorId,
        reason: opts.reason ?? null,
        metadata: { targetBedId: opts.targetBedId, effectiveDate: opts.effectiveDate },
      });
      await tx.insert(hostelAllocationEvents).values({
        tenantId,
        allocationId: destination.id,
        eventType: 'transferred_in',
        actorId,
        reason: opts.reason ?? null,
        metadata: { sourceAllocationId: locked.id, effectiveDate: opts.effectiveDate },
      });

      return { source: { ...locked, state: closedState, effectiveEndDate: closedEnd }, destination };
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      conflict('Transfert impossible : le lit cible est déjà occupé ou réservé sur la période.');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Cancel (reservation only)
// ---------------------------------------------------------------------------

export async function cancelAllocation(tenantId: string, actorId: string, allocationId: string, reason?: string | null) {
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx.update(hostelAllocations)
      .set({ state: 'cancelled', updatedAt: new Date().toISOString() })
      .where(and(
        eq(hostelAllocations.id, allocationId),
        eq(hostelAllocations.tenantId, tenantId),
        eq(hostelAllocations.state, 'reserved'),
      ))
      .returning();
    if (row) {
      await tx.insert(hostelAllocationEvents).values({
        tenantId,
        allocationId,
        eventType: 'cancelled',
        actorId,
        reason: reason ?? null,
      });
    }
    return row ?? null;
  });

  if (claimed) return claimed;

  const current = await loadActiveAllocation(tenantId, allocationId);
  if (current.state === 'cancelled') return current; // idempotent retry
  throw new ApiError(409, 'INVALID_STATE',
    'Seule une réservation non débutée peut être annulée. Utilisez le départ pour une affectation active.');
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listAllocations(tenantId: string, opts?: {
  hostelId?: string | null;
  bedId?: string | null;
  studentId?: string | null;
  state?: string | null;
  asOf?: string | null;
}) {
  const conds = [eq(hostelAllocations.tenantId, tenantId)];
  if (opts?.hostelId) conds.push(eq(hostelRooms.hostelId, opts.hostelId));
  if (opts?.bedId) conds.push(eq(hostelAllocations.bedId, opts.bedId));
  if (opts?.studentId) conds.push(eq(hostelAllocations.studentId, opts.studentId));
  if (opts?.state) conds.push(sql`${hostelAllocations.state} = ${opts.state}`);
  if (opts?.asOf) {
    conds.push(sql`${hostelAllocations.effectiveStartDate} <= ${opts.asOf}`);
    conds.push(sql`${hostelAllocations.effectiveEndDate} > ${opts.asOf}`);
  }

  return db
    .select({
      id: hostelAllocations.id,
      applicationId: hostelAllocations.applicationId,
      studentId: hostelAllocations.studentId,
      studentName: user.name,
      bedId: hostelAllocations.bedId,
      bedCode: hostelBeds.code,
      roomId: hostelRooms.id,
      roomCode: hostelRooms.code,
      hostelId: hostelRooms.hostelId,
      effectiveStartDate: hostelAllocations.effectiveStartDate,
      effectiveEndDate: hostelAllocations.effectiveEndDate,
      state: hostelAllocations.state,
      chargeSnapshot: hostelAllocations.chargeSnapshot,
      sourceAllocationId: hostelAllocations.sourceAllocationId,
      checkedInAt: hostelAllocations.checkedInAt,
      checkedOutAt: hostelAllocations.checkedOutAt,
      notes: hostelAllocations.notes,
      createdAt: hostelAllocations.createdAt,
      updatedAt: hostelAllocations.updatedAt,
    })
    .from(hostelAllocations)
    .innerJoin(hostelBeds, eq(hostelAllocations.bedId, hostelBeds.id))
    .innerJoin(hostelRooms, eq(hostelBeds.roomId, hostelRooms.id))
    .leftJoin(user, eq(hostelAllocations.studentId, user.id))
    .where(and(...conds))
    .orderBy(desc(hostelAllocations.createdAt));
}

export async function getAllocation(tenantId: string, allocationId: string) {
  const [row] = await db
    .select({
      id: hostelAllocations.id,
      applicationId: hostelAllocations.applicationId,
      studentId: hostelAllocations.studentId,
      studentName: user.name,
      bedId: hostelAllocations.bedId,
      bedCode: hostelBeds.code,
      roomId: hostelRooms.id,
      roomCode: hostelRooms.code,
      roomName: hostelRooms.name,
      hostelId: hostelRooms.hostelId,
      effectiveStartDate: hostelAllocations.effectiveStartDate,
      effectiveEndDate: hostelAllocations.effectiveEndDate,
      state: hostelAllocations.state,
      chargeSnapshot: hostelAllocations.chargeSnapshot,
      sourceAllocationId: hostelAllocations.sourceAllocationId,
      checkedInAt: hostelAllocations.checkedInAt,
      checkedOutAt: hostelAllocations.checkedOutAt,
      notes: hostelAllocations.notes,
      createdAt: hostelAllocations.createdAt,
      updatedAt: hostelAllocations.updatedAt,
    })
    .from(hostelAllocations)
    .innerJoin(hostelBeds, eq(hostelAllocations.bedId, hostelBeds.id))
    .innerJoin(hostelRooms, eq(hostelBeds.roomId, hostelRooms.id))
    .leftJoin(user, eq(hostelAllocations.studentId, user.id))
    .where(and(eq(hostelAllocations.id, allocationId), eq(hostelAllocations.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Affectation introuvable.');
  return row;
}

export async function listAllocationEvents(tenantId: string, allocationId: string, canReadSensitive: boolean) {
  const rows = await db
    .select({
      id: hostelAllocationEvents.id,
      allocationId: hostelAllocationEvents.allocationId,
      eventType: hostelAllocationEvents.eventType,
      reason: hostelAllocationEvents.reason,
      metadata: hostelAllocationEvents.metadata,
      createdAt: hostelAllocationEvents.createdAt,
      actorId: hostelAllocationEvents.actorId,
      actorName: user.name,
    })
    .from(hostelAllocationEvents)
    .leftJoin(user, eq(hostelAllocationEvents.actorId, user.id))
    .where(and(
      eq(hostelAllocationEvents.tenantId, tenantId),
      eq(hostelAllocationEvents.allocationId, allocationId),
    ))
    .orderBy(asc(hostelAllocationEvents.createdAt));

  // `reason` is a restricted field: redact unless the caller holds
  // hostel.safeguarding.read (ADR: safeguarding data needs an explicit read).
  return rows.map(r => (canReadSensitive ? r : { ...r, reason: null }));
}
