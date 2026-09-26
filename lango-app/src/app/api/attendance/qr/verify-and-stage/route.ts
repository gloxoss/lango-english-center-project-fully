import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { isCredentialExpired } from '@/libs/api/badge-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { resolveInstructionalDay } from '@/libs/api/school-day';
import { parseJson } from '@/libs/api/validation';
import { authenticateDevice } from '@/libs/attendance/device-auth';
import {
  isCancelled,
  listSessionOccurrences,
  REGISTER_CLOSES_AFTER_MINUTES,
  REGISTER_OPENS_BEFORE_MINUTES,
} from '@/libs/attendance/session-occurrence';
import { db } from '@/libs/DB';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import {
  attendanceRegisters,
  attendanceScanEvents,
  classes,
  classSections,
  identityBadgeCredentials,
  scannerSessions,
  sections,
  user,
} from '@/models/Schema';

type ScanMode = 'classroom' | 'entrance';

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

// "2nde A" — the label a teacher says out loud. The section half alone ("A") is
// ambiguous across classes, so both halves are kept. Null when the student is in
// no section at all, which is a placement gap, not a refusal reason.
async function sectionLabel(tenantId: string, classSectionId: string | null): Promise<string | null> {
  if (!classSectionId) {
    return null;
  }
  const [row] = await db
    .select({ className: classes.name, sectionName: sections.name })
    .from(classSections)
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .where(and(eq(classSections.id, classSectionId), eq(classSections.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    return null;
  }
  const joined = [row.className, row.sectionName].filter(Boolean).join(' ').trim();
  return joined.length > 0 ? joined : null;
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
  // NO DEFAULT. A default of 1 meant every scan that did not state a lesson —
  // which is every scan the scanner sends — was written to period 1 and judged
  // late against period 1's start. The server resolves the lesson from the
  // timetable; this field exists only as an explicit admin override.
  period: z.number().int().min(1).max(12).optional(),
  idempotencyKey: z.string().max(255).optional(),
  // Presented by a PAIRED terminal (phase 7). Optional so a logged-in operator
  // scanning in the browser still works, but when present the device must prove
  // itself and its branch becomes authoritative.
  deviceSecret: z.string().trim().min(1).optional(),
}).strict();

/**
 * A BADGE SCAN STAGES. IT DOES NOT WRITE A MARK (fix-plan-02).
 *
 * Scanning has two homes, and the session is what picks between them:
 *
 *   CLASSROOM — the session is bound to one lesson occurrence
 *   (`scanner_sessions.class_schedule_slot_id`). Only that lesson's section may
 *   badge in, and the scan is judged present/late against THAT lesson's start.
 *   ENTRANCE (portique) — the session has no lesson, or there is no session at
 *   all. Any student of the tenant badges in, at any time.
 *
 * Neither mode writes an `attendance` row: the accepted `attendance_scan_events`
 * row IS the output, and its NULL `attendance_record_id` is how "staged, not yet
 * validated" is represented. The teacher's roll-call submission writes the
 * marks; closing the session points each staged scan at the mark it became.
 *
 * What the scan still has to prove is unchanged — a real, active, unexpired
 * badge, a campus it may serve, an instructional day inside an academic session,
 * and no locked register on the lesson it targets.
 */
export async function POST(request: Request) {
  try {
    // Scanning is a front-desk and gate action as much as a teaching one, so the
    // scanning capability admits reception and the guard. Narrower than
    // attendance.manage on purpose: a scan stages evidence, it writes no mark.
    const context = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'receptionist', 'guard']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.scan');
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
    // allowed to stage anything.
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

    // WHICH HOME THIS SCAN IS IN (fix-plan-02). The session, and only the
    // session, decides: one bound to a lesson is a CLASSROOM scan, one with no
    // lesson (or no session at all) is an ENTRANCE arrival. There is no third
    // mode, and a class picker can no longer stand in for a lesson.
    let scanSession: typeof scannerSessions.$inferSelect | null = null;
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

      scanSession = session;
    }

    const classroomSlotId = scanSession?.classScheduleSlotId ?? null;
    const mode: ScanMode = classroomSlotId ? 'classroom' : 'entrance';

    // The section this scan is scoped to, if any. A session is authoritative: a
    // classroom session carries its lesson's section, and an entrance session
    // carries none — so a browser's stray class selection cannot narrow a
    // portique scan to one class. With no session, whatever the caller named is
    // all there is to go on.
    const resolvedClassSectionId: string | null = scanSession
      ? scanSession.classSectionId
      : (body.classSectionId ?? null);

    let section: { id: string; classId: string; branchId: string | null } | null = null;
    if (resolvedClassSectionId) {
      // Validate the class section belongs to this tenant and resolve its classId
      // and campus (branch scope is enforced below, exactly like the manual route).
      const [row] = await db
        .select({ id: classSections.id, classId: classSections.classId, branchId: classes.branchId })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .where(and(eq(classSections.id, resolvedClassSectionId), eq(classSections.tenantId, tenantId)))
        .limit(1);

      if (!row) {
        await recordRejected('INVALID_CLASS');
        throw new ApiError(404, 'CLASS_NOT_FOUND', 'Classe/section introuvable pour cet établissement.');
      }
      section = row;

      // BRANCH SCOPE: a branch-limited caller cannot stage for another campus.
      if (effectiveBranchId && row.branchId !== effectiveBranchId) {
        await recordRejected('WRONG_BRANCH', {
          credentialId: badge.id,
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId,
        });
        throw new ApiError(403, 'FORBIDDEN', 'Cette section appartient à un autre campus.');
      }
    }

    // ROSTER CHECK — CLASSROOM ONLY. A classroom session is bound to one lesson,
    // so the student must be in that lesson's section; the refusal names them
    // because the operator has to see WHO is holding the wrong badge. An
    // entrance scan has no lesson to belong to, so any student of the tenant is
    // accepted whatever their section — and an unplaced student is not refused
    // over a placement gap.
    if (mode === 'classroom' && scannedUser.classSectionId !== resolvedClassSectionId) {
      // Name the student AND the section they actually belong to: "Rania
      // Sefrioui — 2nde A". A name alone tells the teacher someone is in the
      // wrong room but not which room to send them to; the section is the part
      // they act on. The structured fields ride along in `details` so a screen
      // can render them without parsing the message.
      const ownSection = await sectionLabel(tenantId, scannedUser.classSectionId);
      const who = ownSection ? `${scannedUser.name} — ${ownSection}` : scannedUser.name;
      await recordRejected('WRONG_CLASS', {
        credentialId: badge.id,
        studentId: scannedUser.id,
        classSectionId: resolvedClassSectionId,
      });
      throw new ApiError(
        422,
        'WRONG_CLASS',
        `${who} n'appartient pas à ce cours.`,
        { studentName: scannedUser.name, studentSection: ownSection },
      );
    }

    const [tzEff, graceEff] = await Promise.all([
      getEffectiveValueWithLegacyFallback(tenantId, null, 'localization.timezone'),
      getEffectiveValueWithLegacyFallback(tenantId, null, 'attendance.lateGraceMinutes'),
    ]);
    const localeTimezone = (tzEff.value as string) || DEFAULT_TIMEZONE;
    const graceMinutes = typeof graceEff.value === 'number' ? graceEff.value : 15;
    // `attendance.periodStartTime` is no longer read here: lateness is measured
    // from the resolved lesson's own start. The setting is still declared and
    // still shown in Settings, so it is now configurable but unused — flagged,
    // not silently deleted, because retiring a product setting is not this fix.

    const tenantNow = nowInTimezone(localeTimezone);
    const targetDate = tenantNow.toISOString().slice(0, 10);
    // A session belongs to the day its lesson is on, so a scan made through it
    // is judged on that day rather than on whatever the clock has rolled to.
    const scanDate = scanSession?.date ?? targetDate;

    // THE SERVER RESOLVES THE LESSON (fix-plan-01 item 1).
    //
    // The client never chose a period, so every scan — a 14:00 one included — was
    // written to period 1 and judged against period 1's start, which also undid
    // the session-relative lateness fix: that looked up the occurrence BY the
    // period it was given, so it always found period 1.
    //
    // The lesson is now whichever scheduled occurrence contains the current time,
    // using the SAME window as the teacher register (start − 5 min … end + 15 min)
    // through the shared constants, never a copy.
    //
    // Cancelled occurrences are skipped: a lesson that is not happening is not a
    // target. A moved or substituted lesson is already reflected in the
    // occurrence, since the resolver applies phase 6's exceptions.
    //
    // In a CLASSROOM session none of this picks the lesson — the session names
    // it, and the clock there decides only present vs late against it.
    const minutesOf = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };
    const nowMinutes = tenantNow.getUTCHours() * 60 + tenantNow.getUTCMinutes();

    // Which section's timetable is consulted. A classroom session names one; an
    // entrance scan has none of its own, so the student's own lessons are the
    // only ones that could be reported back to them.
    const lessonSectionId = resolvedClassSectionId
      ?? (mode === 'entrance' ? scannedUser.classSectionId : null);

    let dayOccurrences: Awaited<ReturnType<typeof listSessionOccurrences>> = [];
    if (lessonSectionId) {
      try {
        dayOccurrences = await listSessionOccurrences({
          tenantId,
          date: scanDate,
          classSectionId: lessonSectionId,
        });
      } catch {
        // A timetable read must never block a scan: a classroom session then
        // finds no occurrence and refuses below, an entrance scan is unaffected.
      }
    }

    const live = dayOccurrences.filter(o => !isCancelled(o));

    let target: (typeof live)[number] | null = null;

    if (mode === 'classroom') {
      // A CLASSROOM SESSION NAMES ITS LESSON, so the clock cannot move it. The
      // clock decides only present vs late, against that lesson's own start
      // (which already carries any exception times). Resolving the lesson from
      // the clock instead would file a scan made just before the window opens —
      // or just after it closes — against a different lesson than the one the
      // teacher activated, which is the very drift this mode exists to prevent.
      // An explicit override cannot move it either: the session is the truth.
      //
      // Looked up among ALL the day's occurrences, not the live ones, because a
      // cancelled lesson is a different refusal from a lesson that is not there
      // (see below) and filtering first would hide which one this is.
      const occurrence = dayOccurrences.find(o => o.slotId === classroomSlotId) ?? null;

      if (!occurrence) {
        // The slot resolves to nothing at all — the timetable moved under the
        // session. Refuse rather than guess at a lesson.
        await recordRejected('NO_LESSON_NOW', {
          credentialId: badge.id,
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId,
        });
        throw new ApiError(422, 'NO_LESSON_NOW', 'La séance de cette session de scan n\'est plus programmée pour ce jour.');
      }

      if (isCancelled(occurrence)) {
        // Same condition the session route refuses when such a session is opened,
        // so it answers with the same code: one condition, one code, whether the
        // operator is trying to open the session or scanning into it.
        await recordRejected('LESSON_CANCELLED', {
          credentialId: badge.id,
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId,
        });
        throw new ApiError(422, 'LESSON_CANCELLED', 'Ce cours est annulé, le scan ne peut pas être enregistré.');
      }

      target = occurrence;
    } else {
      const inWindow = live.find((o) => {
        const opens = minutesOf(o.startTime) - REGISTER_OPENS_BEFORE_MINUTES;
        const closes = minutesOf(o.endTime) + REGISTER_CLOSES_AFTER_MINUTES;
        return nowMinutes >= opens && nowMinutes <= closes;
      });

      // An explicit override is validated against the day's real occurrences,
      // not trusted: an admin may pick a lesson, but not invent one.
      const overridden = body.period !== undefined
        ? live.find(o => o.period === body.period)
        : undefined;

      if (body.period !== undefined && !overridden) {
        await recordRejected('LESSON_NOT_SCHEDULED', {
          credentialId: badge.id,
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId,
        });
        throw new ApiError(422, 'LESSON_NOT_SCHEDULED', 'Cette séance n\'est pas programmée pour cette classe ce jour-là.');
      }

      // No lesson is NOT a refusal in entrance mode: an arrival at the gate is
      // valid at any time. The lesson, when there is one, only feeds the
      // "en retard pour Français" line and changes nothing about what is written.
      target = overridden ?? inWindow ?? null;
    }

    // True when the scan is nothing but a campus arrival: the portique accepted
    // the student and no lesson was resolved to report.
    const arrivalOnly = mode === 'entrance' && !target;

    // Lateness is measured from THIS lesson's start, not a school-wide one.
    const resolvedLesson = target
      ? {
          slotId: target.slotId,
          period: target.period,
          subject: target.subjectName,
          startTime: target.startTime,
          endTime: target.endTime,
          room: target.room,
        }
      : null;

    // CALENDAR + SESSION TRUTH (Phases 4/5): the date must fall inside an
    // academic session AND be an instructional day for the section. Fails
    // closed, never guesses. Judged on the scan's own section, or on the
    // student's when the scan is not scoped to one — so a portique scan answers
    // for the day THAT student has.
    //
    // DELIBERATE TRADE, not an oversight: a student with no class section at all
    // (the office has not placed them yet) skips this check entirely. There is no
    // section day to judge them against, and the alternatives were to refuse a
    // child's arrival over a placement gap, or to duplicate the session-range
    // query here. What is skipped is the refusal, never the arrival record.
    const calendarSectionId = resolvedClassSectionId ?? scannedUser.classSectionId;
    let sessionYearId: string | null = null;

    if (calendarSectionId) {
      const schoolDay = await resolveInstructionalDay({ tenantId, sectionId: calendarSectionId, date: scanDate });

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

      sessionYearId = schoolDay.sessionYearId;
    }

    // Locked-register check: the register is resolved at its exact scope
    // (section + date + period + session). A LOCKED register cannot be mutated;
    // a REOPENED register is an authorized correction window and stays writable.
    // Only meaningful when the scan targets a lesson in a known class — an
    // arrival with no class has no register that could be locked, and refusing
    // it would gate the campus on some other lesson's state.
    let register: { id: string; status: string; reference: string } | null = null;

    if (target && section && sessionYearId && resolvedClassSectionId) {
      const [row] = await db
        .select({ id: attendanceRegisters.id, status: attendanceRegisters.status, reference: attendanceRegisters.reference })
        .from(attendanceRegisters)
        .where(and(
          eq(attendanceRegisters.tenantId, tenantId),
          eq(attendanceRegisters.classId, section.classId),
          eq(attendanceRegisters.classSectionId, resolvedClassSectionId),
          eq(attendanceRegisters.date, scanDate),
          eq(attendanceRegisters.period, target.period),
          eq(attendanceRegisters.sessionYearId, sessionYearId),
        ))
        .limit(1);

      register = row ?? null;
    }

    if (register && register.status === 'LOCKED') {
      await recordRejected('REGISTER_LOCKED', {
        credentialId: badge.id,
        studentId: scannedUser.id,
        classSectionId: resolvedClassSectionId,
        registerId: register.id,
      });
      throw new ApiError(409, 'REGISTER_LOCKED', `Le registre (${register.reference}) est verrouillé.`);
    }

    // Idempotency: inside a scanner session, one accepted scan per credential
    // per session. That is the whole rule now — a scan writes no mark, so
    // outside a session there is nothing for a re-scan to duplicate, and the
    // scan events themselves are the record of what happened at the door.
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
    }

    if (isDuplicate) {
      // Log the duplicate attempt as its own scan event so the audit trail and
      // the "Déjà scannés" aggregate stay meaningful. already_scanned events
      // never feed the duplicate check (which filters on 'accepted'), so
      // idempotency is preserved.
      const [duplicateScanEvent] = await db
        .insert(attendanceScanEvents)
        .values({
          tenantId,
          sessionId: body.sessionId || null,
          credentialId: badge.id,
          studentId: scannedUser.id,
          classSectionId: resolvedClassSectionId ?? scannedUser.classSectionId,
          registerId: register?.id ?? null,
          resultStatus: 'already_scanned',
          stagedStatus: duplicateStagedStatus,
          idempotencyKey: body.idempotencyKey || null,
          // Tenant wall-clock time, like every other scan decision.
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
          // Same contract as an accepted scan, so the client reads one shape.
          lesson: resolvedLesson,
          mode,
          arrivalOnly,
        },
      });
    }

    // 'present' when no lesson was resolved: with nothing to be late for, an
    // arrival is on time by definition.
    const stagedStatus = target
      ? computeStagedStatus(tenantNow, target.startTime, graceMinutes)
      : 'present';

    // THE STAGED SCAN IS THE WHOLE OUTPUT. No `attendance` row is written and
    // `attendanceRecordId` is left NULL — that NULL is what "not yet validated"
    // means, and closing the session fills it in from the mark the teacher's
    // submission created.
    const [scanEvent] = await db
      .insert(attendanceScanEvents)
      .values({
        tenantId,
        sessionId: body.sessionId || null,
        credentialId: badge.id,
        studentId: scannedUser.id,
        // The lesson's section in a classroom, the student's own at the gate:
        // either way the scan belongs to a class, so the class-scoped scan feed
        // and its teacher scope can still see it.
        classSectionId: resolvedClassSectionId ?? scannedUser.classSectionId,
        registerId: register?.id ?? null,
        resultStatus: 'accepted',
        stagedStatus,
        idempotencyKey: body.idempotencyKey || null,
        // Tenant wall-clock time, like every other scan decision.
        scannedAt: tenantNow.toISOString(),
      })
      .returning();

    recordAudit(context, 'create', 'attendance_scan', scanEvent!.id, {
      stagedStatus,
      classSectionId: resolvedClassSectionId,
      mode,
      period: target?.period ?? null,
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
        scanEvent,
        resultStatus: 'accepted',
        // Which lesson this scan concerns. In a classroom the client never chose
        // it, so it has to be told — otherwise the last-scan card shows whatever
        // class the operator had picked, which is a different lesson. At the
        // gate it is the student's own lesson, for the "en retard pour" line, or
        // null when no lesson is running.
        lesson: resolvedLesson,
        mode,
        // No lesson resolved in entrance mode: the scan is only a campus arrival
        // and nothing else should be read into it.
        arrivalOnly,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
