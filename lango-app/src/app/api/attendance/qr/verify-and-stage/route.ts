import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { detectAndRecordFlags } from '@/libs/api/attendance-flags';
import { recalculateStudentAttendanceSummary } from '@/libs/api/attendance-summary';
import { recordAudit } from '@/libs/api/audit';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { isCredentialExpired } from '@/libs/api/badge-service';
import { authenticateDevice } from '@/libs/attendance/device-auth';
import { listSessionOccurrences } from '@/libs/attendance/session-occurrence';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { resolveInstructionalDay } from '@/libs/api/school-day';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import {
  attendance,
  attendanceRegisters,
  attendanceScanEvents,
  classes,
  classSections,
  identityBadgeCredentials,
  scannerSessions,
  user,
} from '@/models/Schema';

const DEFAULT_TIMEZONE = 'Africa/Casablanca';

// Returns a Date whose UTC fields carry the tenant's wall-clock time, so date /
// lateness decisions are made in the school's timezone, not the server's.
function nowInTimezone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string): number => Number(parts.find(p => p.type === type)?.value ?? '0');
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
}

// Before (period start + grace): present. After: late.
function computeStagedStatus(tenantNow: Date, periodStart: string, graceMinutes: number): 'present' | 'late' {
  const [hRaw = '08', mRaw = '00'] = periodStart.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  const threshold = new Date(tenantNow);
  threshold.setUTCHours(h, m + graceMinutes, 0, 0);
  return tenantNow.getTime() <= threshold.getTime() ? 'present' : 'late';
}

const verifyQrSchema = z.object({
  rawToken: z.string().trim().min(1),
  classSectionId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  period: z.number().int().min(1).max(12).optional().default(1),
  idempotencyKey: z.string().max(255).optional(),
  // Presented by a PAIRED terminal (phase 7). Optional so a logged-in operator
  // scanning in the browser still works, but when present the device must prove
  // itself and its branch becomes authoritative.
  deviceSecret: z.string().trim().min(1).optional(),
}).strict();

/**
 * QR ATTENDANCE PARITY (G15): a badge scan is a canonical attendance write.
 *
 * It resolves the same authoritative context as POST /api/attendance — tenant,
 * campus, section, academic session (date bounds), instructional day, register
 * lock — and upserts the same active-mark shape (session + section + period)
 * guarded by the canonical partial unique index. Corrections keep the mark's
 * identity (update in place + before/after audit), and every accepted mark
 * recalculates the summary cache and the flag engine exactly like a manual
 * submission. No QR-specific shortcut around canonical attendance truth.
 */
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const body = await parseJson(request, verifyQrSchema);

    // DEVICE IDENTITY (phase 7). FIRST, before the credential is even read: a
    // terminal that cannot prove itself has no business being told whether a
    // badge exists. Its own branch is authoritative — a kiosk cannot widen its
    // scope by claiming a different campus.
    const device = body.deviceSecret
      ? await authenticateDevice(tenantId, body.deviceSecret)
      : null;
    const effectiveBranchId = device?.branchId ?? context.branchId;

    // Compute HMAC hash of incoming raw token
    const tokenHash = computeHmacHash(body.rawToken);

    // Resolve credential strictly by (tenantId, tokenHash) — never by name/id
    const [badge] = await db
      .select()
      .from(identityBadgeCredentials)
      .where(
        and(
          eq(identityBadgeCredentials.tenantId, tenantId),
          eq(identityBadgeCredentials.tokenHash, tokenHash),
        ),
      )
      .limit(1);

    const recordRejected = (
      rejectionReason: string,
      overrides: Partial<typeof attendanceScanEvents.$inferInsert> = {},
    ) => db.insert(attendanceScanEvents).values({
      tenantId,
      sessionId: body.sessionId || null,
      classSectionId: body.classSectionId || null,
      resultStatus: 'rejected',
      rejectionReason,
      idempotencyKey: body.idempotencyKey || null,
      ...overrides,
    });

    if (!badge) {
      await recordRejected('INVALID_CREDENTIAL');
      throw new ApiError(404, 'BADGE_INVALID', 'Badge QR non reconnu ou expiré.');
    }

    if (badge.status !== 'active') {
      await recordRejected(`BADGE_${badge.status.toUpperCase()}`, {
        credentialId: badge.id,
        studentId: badge.userId,
      });

      throw new ApiError(422, `BADGE_${badge.status.toUpperCase()}`, `Ce badge est ${badge.status}.`);
    }

    // An active credential can still be past its expiry date. The status column
    // alone cannot express that, so it is checked here before the badge is
    // allowed to write attendance.
    if (isCredentialExpired(badge)) {
      await recordRejected('BADGE_EXPIRED', {
        credentialId: badge.id,
        studentId: badge.userId,
      });

      throw new ApiError(422, 'BADGE_EXPIRED', 'Ce badge a expiré.');
    }

    // Resolve user details (tenant-scoped)
    const [scannedUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        classSectionId: user.classSectionId,
      })
      .from(user)
      .where(and(eq(user.id, badge.userId), eq(user.tenantId, tenantId)))
      .limit(1);

    if (!scannedUser) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Élève / Utilisateur introuvable.');
    }

    // Resolve the class context: an active scanner session wins (it carries the
    // roster-scoped classSectionId), otherwise fall back to body.classSectionId.
    let resolvedClassSectionId: string | null = body.classSectionId ?? null;
    if (body.sessionId) {
      const [session] = await db
        .select()
        .from(scannerSessions)
        .where(and(eq(scannerSessions.id, body.sessionId), eq(scannerSessions.tenantId, tenantId)))
        .limit(1);

      if (!session) {
        await recordRejected('SESSION_INVALID');
        throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session de scan introuvable.');
      }
      if (session.status !== 'active' || (session.endedAt && session.endedAt !== null)) {
        await recordRejected('SESSION_CLOSED');
        throw new ApiError(409, 'SESSION_CLOSED', 'Session de scan fermée.');
      }
      if (session.classSectionId) {
        resolvedClassSectionId = session.classSectionId;
      }
    }

    if (!resolvedClassSectionId) {
      await recordRejected('CLASS_CONTEXT_REQUIRED');
      throw new ApiError(400, 'CLASS_CONTEXT_REQUIRED', 'Une classe (ou session de scan) est requise pour valider le badge.');
    }

    // Validate the class section belongs to this tenant and resolve its classId
    // and campus (branch scope is enforced below, exactly like the manual route).
    const [section] = await db
      .select({ id: classSections.id, classId: classSections.classId, branchId: classes.branchId })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .where(and(eq(classSections.id, resolvedClassSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    if (!section) {
      await recordRejected('INVALID_CLASS');
      throw new ApiError(404, 'CLASS_NOT_FOUND', 'Classe/section introuvable pour cet établissement.');
    }

    // BRANCH SCOPE: a branch-limited caller cannot stage marks for another campus.
    if (effectiveBranchId && section.branchId !== effectiveBranchId) {
      await recordRejected('WRONG_BRANCH', {
        credentialId: badge.id,
        studentId: scannedUser.id,
        classSectionId: resolvedClassSectionId,
      });
      throw new ApiError(403, 'FORBIDDEN', 'Cette section appartient à un autre campus.');
    }

    // Roster check: the scanned student's real class-section must match the one
    // the scan targets. Unplaced students cannot be staged either.
    if (scannedUser.classSectionId !== resolvedClassSectionId) {
      await recordRejected('WRONG_CLASS', {
        credentialId: badge.id,
        studentId: scannedUser.id,
        classSectionId: resolvedClassSectionId,
      });
      throw new ApiError(422, 'WRONG_CLASS', `Ce badge (${scannedUser.name}) n'appartient pas à cette classe/section.`);
    }

    const [tzEff, graceEff, periodEff] = await Promise.all([
      getEffectiveValueWithLegacyFallback(tenantId, null, 'localization.timezone'),
      getEffectiveValueWithLegacyFallback(tenantId, null, 'attendance.lateGraceMinutes'),
      getEffectiveValueWithLegacyFallback(tenantId, null, 'attendance.periodStartTime'),
    ]);
    const localeTimezone = (tzEff.value as string) || DEFAULT_TIMEZONE;
    const graceMinutes = typeof graceEff.value === 'number' ? graceEff.value : 15;
    const settingsPeriodStart = (periodEff.value as string) || '08:00';

    const tenantNow = nowInTimezone(localeTimezone);
    const targetDate = tenantNow.toISOString().slice(0, 10);

    // LATENESS IS RELATIVE TO THE REAL LESSON (phase 7). A single school-wide
    // start time judged a 14:00 lesson late against 08:00, so every afternoon
    // scan was late and every morning scan was early. The scheduled occurrence
    // for this section and day carries the actual start.
    //
    // Falls back to the configured period start when the timetable has nothing
    // for that section and day — a legacy or unscheduled section still has to
    // decide something, and the old behaviour is the honest default.
    let periodStart = settingsPeriodStart;
    try {
      const occurrences = await listSessionOccurrences({
        tenantId,
        date: targetDate,
        classSectionId: resolvedClassSectionId,
      });
      const scheduled = occurrences.find(o => o.period === body.period);
      if (scheduled) {
        periodStart = scheduled.startTime;
      }
    } catch {
      // A timetable read must never block a scan; the fallback is the setting.
    }
    const period = body.period;

    // CALENDAR + SESSION TRUTH (Phases 4/5): the date must fall inside an
    // academic session AND be an instructional day for this section; the
    // resolved session is written on the mark. Fails closed, never guesses.
    const schoolDay = await resolveInstructionalDay({ tenantId, sectionId: resolvedClassSectionId, date: targetDate });
    if (!schoolDay.instructional || !schoolDay.sessionYearId) {
      const reason = schoolDay.reason === 'SESSION_OUT_OF_RANGE' ? 'DATE_OUTSIDE_SESSION' : 'NON_INSTRUCTIONAL_DAY';
      await recordRejected(reason, {
        credentialId: badge.id,
        studentId: scannedUser.id,
        classSectionId: resolvedClassSectionId,
      });
      throw new ApiError(
        422,
        reason,
        reason === 'DATE_OUTSIDE_SESSION'
          ? 'Cette date ne fait partie d\'aucune année scolaire de cet établissement.'
          : 'Cette date n\'est pas un jour d\'enseignement pour cette section.',
      );
    }
    const sessionYearId = schoolDay.sessionYearId;

    // Locked-register check: the register is resolved at its exact scope
    // (section + date + period + session). A LOCKED register cannot be mutated;
    // a REOPENED register is an authorized correction window and stays writable.
    const [register] = await db
      .select({ id: attendanceRegisters.id, status: attendanceRegisters.status, reference: attendanceRegisters.reference })
      .from(attendanceRegisters)
      .where(and(
        eq(attendanceRegisters.tenantId, tenantId),
        eq(attendanceRegisters.classId, section.classId),
        eq(attendanceRegisters.classSectionId, resolvedClassSectionId),
        eq(attendanceRegisters.date, targetDate),
        eq(attendanceRegisters.period, period),
        eq(attendanceRegisters.sessionYearId, sessionYearId),
      ))
      .limit(1);

    if (register && register.status === 'LOCKED') {
      await recordRejected('REGISTER_LOCKED', {
        credentialId: badge.id,
        studentId: scannedUser.id,
        classSectionId: resolvedClassSectionId,
        registerId: register.id,
      });
      throw new ApiError(409, 'REGISTER_LOCKED', `Le registre (${register.reference}) est verrouillé.`);
    }

    // Idempotency (canonical):
    //  * inside a scanner session: one accepted scan per credential per session;
    //  * outside one: a re-scan over a mark that a previous SCAN already wrote
    //    for this exact (student, date, period, section) is a duplicate. A
    //    manual mark is NOT a duplicate — scanning over it is an authorized
    //    in-place correction (G15.9), never a second row.
    let isDuplicate = false;
    let duplicateStagedStatus: string | null = null;

    if (body.sessionId) {
      const [duplicateEvent] = await db
        .select()
        .from(attendanceScanEvents)
        .where(and(
          eq(attendanceScanEvents.tenantId, tenantId),
          eq(attendanceScanEvents.credentialId, badge.id),
          eq(attendanceScanEvents.resultStatus, 'accepted'),
          eq(attendanceScanEvents.sessionId, body.sessionId),
        ))
        .limit(1);
      if (duplicateEvent) {
        isDuplicate = true;
        duplicateStagedStatus = duplicateEvent.stagedStatus || null;
      }
    } else {
      const [scanWrittenMark] = await db
        .select({ status: attendance.status, scanEventId: attendance.scanEventId })
        .from(attendance)
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.studentId, scannedUser.id),
          eq(attendance.date, targetDate),
          eq(attendance.period, period),
          eq(attendance.classSectionId, resolvedClassSectionId),
          eq(attendance.isVoided, false),
        ))
        .limit(1);
      if (scanWrittenMark?.scanEventId) {
        isDuplicate = true;
        duplicateStagedStatus = scanWrittenMark.status;
      }
    }

    if (isDuplicate) {
      // Log the duplicate attempt as its own scan event so the audit trail and
      // the "Déjà scannés" aggregate stay meaningful. No attendance row is
      // written and already_scanned events never feed the duplicate check
      // (which filters on 'accepted'), so idempotency is preserved.
      const [duplicateScanEvent] = await db
        .insert(attendanceScanEvents)
        .values({
          tenantId,
          sessionId: body.sessionId || null,
          credentialId: badge.id,
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId,
          registerId: register?.id ?? null,
          resultStatus: 'already_scanned',
          stagedStatus: duplicateStagedStatus,
          idempotencyKey: body.idempotencyKey || null,
          // Tenant wall-clock time: the duplicate window compares against the
          // same tenant-clock date as the attendance mark.
          scannedAt: tenantNow.toISOString(),
        })
        .returning();

      return NextResponse.json({
        success: true,
        data: {
          student: {
            id: scannedUser.id,
            name: scannedUser.name,
            email: scannedUser.email,
            image: scannedUser.image,
          },
          stagedStatus: duplicateStagedStatus || 'present',
          scanEvent: duplicateScanEvent,
          resultStatus: 'already_scanned',
        },
      });
    }

    const stagedStatus = computeStagedStatus(tenantNow, periodStart, graceMinutes);

    const staged = await db.transaction(async (tx) => {
      const [scanEvent] = await tx
        .insert(attendanceScanEvents)
        .values({
          tenantId,
          sessionId: body.sessionId || null,
          credentialId: badge.id,
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId,
          registerId: register?.id ?? null,
          resultStatus: 'accepted',
          stagedStatus,
          idempotencyKey: body.idempotencyKey || null,
          // Tenant wall-clock time: the duplicate window compares against the
          // same tenant-clock date as the attendance mark.
          scannedAt: tenantNow.toISOString(),
        })
        .returning();

      // CANONICAL ACTIVE-MARK UPSERT: same key as POST /api/attendance
      // (tenant, student, session, date, period, section). Corrections update in
      // place with a before/after audit — nothing is deleted, no duplicate
      // active marks can exist (partial unique index guards the race).
      const [existing] = await tx
        .select()
        .from(attendance)
        .where(and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.studentId, scannedUser.id),
          eq(attendance.date, targetDate),
          eq(attendance.period, period),
          eq(attendance.classSectionId, resolvedClassSectionId),
          eq(attendance.isVoided, false),
        ))
        .limit(1);

      const lateMinutes = stagedStatus === 'late' ? (existing?.lateMinutes ?? 0) : null;
      let attendanceRow: typeof attendance.$inferSelect;
      let changed = false;

      if (existing && existing.status === stagedStatus && existing.lateMinutes === lateMinutes) {
        // Unchanged re-scan: keep the authoritative mark untouched.
        attendanceRow = existing;
      } else if (existing) {
        const [updated] = await tx
          .update(attendance)
          .set({
            status: stagedStatus,
            markedById: context.userId,
            scanEventId: scanEvent!.id,
            registerId: register?.id ?? existing.registerId,
            lateMinutes,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(attendance.id, existing.id))
          .returning();
        attendanceRow = updated!;
        changed = true;

        recordAudit(context, 'update', 'attendance', existing.id, {
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId,
          date: targetDate,
          period,
          before: { status: existing.status, lateMinutes: existing.lateMinutes, note: existing.note },
          after: { status: stagedStatus, lateMinutes, note: existing.note },
          reason: 'qr_scan_correction',
        });
      } else {
        const [inserted] = await tx
          .insert(attendance)
          .values({
            tenantId,
            studentId: scannedUser.id,
            studentGroupId: section.classId,
            classSectionId: resolvedClassSectionId,
            academicYearId: sessionYearId,
            period,
            date: targetDate,
            status: stagedStatus,
            markedById: context.userId,
            isVoided: false,
            registerId: register?.id ?? null,
            scanEventId: scanEvent!.id,
            lateMinutes,
          })
          .onConflictDoUpdate({
            target: [attendance.tenantId, attendance.studentId, attendance.academicYearId, attendance.date, attendance.period, attendance.classSectionId],
            targetWhere: sql`${attendance.isVoided} = false AND ${attendance.classSectionId} IS NOT NULL`,
            set: {
              status: stagedStatus,
              markedById: context.userId,
              scanEventId: scanEvent!.id,
              registerId: register?.id ?? null,
              lateMinutes,
              updatedAt: new Date().toISOString(),
            },
          })
          .returning();
        attendanceRow = inserted!;
        changed = true;

        recordAudit(context, 'create', 'attendance', inserted!.id, {
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId,
          date: targetDate,
          period,
          after: { status: stagedStatus, lateMinutes, note: null },
          source: 'qr_scan',
        });
      }

      // Side effects run only when the mark actually changed — the same
      // summary/flag convergence as the manual route.
      if (changed) {
        await recalculateStudentAttendanceSummary(tenantId, scannedUser.id, tx);
        await detectAndRecordFlags(tenantId, scannedUser.id, targetDate, stagedStatus, tx);
      }

      // Complete the evidence chain: scan event -> attendance row.
      await tx
        .update(attendanceScanEvents)
        .set({ attendanceRecordId: attendanceRow.id })
        .where(eq(attendanceScanEvents.id, scanEvent!.id));

      return { scanEvent: scanEvent!, attendanceRow };
    });

    recordAudit(context, 'create', 'attendance_scan', staged.scanEvent.id, {
      stagedStatus,
      classSectionId: resolvedClassSectionId,
      period,
    });

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: scannedUser.id,
          name: scannedUser.name,
          email: scannedUser.email,
          image: scannedUser.image,
        },
        stagedStatus,
        scanEvent: staged.scanEvent,
        attendance: staged.attendanceRow,
        resultStatus: 'accepted',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
