// Attendance evidence chain: immutable participant events -> derived summaries
// (interval union, reconnect-aware) -> reviewed reconciliation -> explicit post
// to the core attendance register.
//
// Raw events are never mutated; re-derivation only refreshes the derived
// projection. A reconciliation that has been proposed/approved/posted is
// preserved across re-derivation so an approved outcome is not silently reset.
import { and, eq, inArray } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import {
  attendance, classSections, liveClassAttendanceSummaries, liveClassParticipantEvents,
  liveClassSessions, user,
} from '@/models/Schema';
import { recordAudit } from '@/libs/api/audit';
import { resolveRegisterForSubmission } from '@/libs/api/attendance-registers';
import { recalculateStudentAttendanceSummary } from '@/libs/api/attendance-summary';
import { detectAndRecordFlags } from '@/libs/api/attendance-flags';
import { loadSession } from './session-service';

const PRESENCE_THRESHOLD = 0.6; // >= 60% of session duration counts as present
const LATE_GRACE_SECONDS = 5 * 60; // first join > 5 min after start => late
const EARLY_GRACE_SECONDS = 5 * 60; // last leave > 5 min before end => early
const REGISTER_PERIOD = 0; // virtual live-class period (no physical timetable slot)

export type SummaryStatus = 'present' | 'late' | 'early' | 'absent' | 'unknown';

type ComputedSummary = {
  userId: string;
  participantRole: string;
  firstJoinAt: string | null;
  lastLeaveAt: string | null;
  totalPresenceSeconds: number;
  intervals: Array<{ start: string; end: string }>;
  reconnectCount: number;
  lateJoinSeconds: number;
  earlyLeaveSeconds: number;
  status: SummaryStatus;
};

function computeFromEvents(
  events: Array<typeof liveClassParticipantEvents.$inferSelect>,
  startMs: number,
  endMs: number,
): ComputedSummary {
  const timeline = events
    .filter(e => e.eventType === 'joined' || e.eventType === 'left' || e.eventType === 'reconnect')
    .map(e => ({ t: new Date(e.providerTimestamp).getTime(), type: e.eventType }))
    .sort((a, b) => a.t - b.t);

  const intervals: Array<{ start: number; end: number }> = [];
  let open: number | null = null;
  let reconnectCount = 0;

  for (const ev of timeline) {
    if (ev.type === 'joined') {
      if (open !== null) {
        // Join while already open: close the segment and start a new one (reconnect).
        intervals.push({ start: open, end: ev.t });
        reconnectCount++;
      }
      open = ev.t;
    } else if (ev.type === 'reconnect') {
      if (open !== null) {
        intervals.push({ start: open, end: ev.t });
        reconnectCount++;
      }
      open = ev.t;
    } else if (ev.type === 'left') {
      if (open !== null) {
        intervals.push({ start: open, end: ev.t });
        open = null;
      }
    }
  }
  // Still present at the end of the recorded evidence: close at session end.
  if (open !== null) intervals.push({ start: open, end: endMs });

  const totalPresenceSeconds = intervals.reduce((sum, i) => sum + Math.max(0, i.end - i.start), 0) / 1000;
  const firstJoinAt = intervals.length > 0 ? new Date(intervals[0]!.start).toISOString() : null;
  const lastLeaveAt = intervals.length > 0 ? new Date(intervals[intervals.length - 1]!.end).toISOString() : null;

  const durationSeconds = Math.max(1, (endMs - startMs) / 1000);
  const ratio = totalPresenceSeconds / durationSeconds;
  const isLate = firstJoinAt !== null && new Date(firstJoinAt).getTime() > startMs + LATE_GRACE_SECONDS * 1000;
  const isEarly = lastLeaveAt !== null && new Date(lastLeaveAt).getTime() < endMs - EARLY_GRACE_SECONDS * 1000;

  let status: SummaryStatus;
  if (totalPresenceSeconds === 0) {
    status = 'absent';
  } else if (ratio >= PRESENCE_THRESHOLD) {
    status = isLate ? 'late' : isEarly ? 'early' : 'present';
  } else {
    status = isLate ? 'late' : isEarly ? 'early' : 'unknown';
  }

  return {
    userId: events[0]!.userId!,
    participantRole: events[0]!.participantRole ?? 'student',
    firstJoinAt,
    lastLeaveAt,
    totalPresenceSeconds: Math.round(totalPresenceSeconds),
    intervals: intervals.map(i => ({ start: new Date(i.start).toISOString(), end: new Date(i.end).toISOString() })),
    reconnectCount,
    lateJoinSeconds: isLate && firstJoinAt ? Math.round((new Date(firstJoinAt).getTime() - startMs) / 1000) : 0,
    earlyLeaveSeconds: isEarly && lastLeaveAt ? Math.round((endMs - new Date(lastLeaveAt).getTime()) / 1000) : 0,
    status,
  };
}

async function computeSummariesForSession(tenantId: string, sessionId: string): Promise<ComputedSummary[]> {
  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');
  const startMs = new Date(session.scheduledStart).getTime();
  const endMs = new Date(session.scheduledEnd).getTime();

  const events = await db
    .select()
    .from(liveClassParticipantEvents)
    .where(eq(liveClassParticipantEvents.sessionId, sessionId))
    .orderBy(liveClassParticipantEvents.providerTimestamp);

  const byUser = new Map<string, Array<typeof liveClassParticipantEvents.$inferSelect>>();
  for (const ev of events) {
    if (!ev.userId) continue;
    const list = byUser.get(ev.userId) ?? [];
    list.push(ev);
    byUser.set(ev.userId, list);
  }

  const result: ComputedSummary[] = [];
  for (const [userId, list] of byUser) {
    const computed = computeFromEvents(list, startMs, endMs);
    result.push({ ...computed, userId });
  }
  return result;
}

async function upsertSummary(
  tenantId: string,
  sessionId: string,
  computed: ComputedSummary,
  nextState: string,
  ctx: RequestContext | null,
  note?: string,
) {
  const now = new Date().toISOString();
  const [existing] = await db
    .select({
      reconciliationState: liveClassAttendanceSummaries.reconciliationState,
      reconciliationNote: liveClassAttendanceSummaries.reconciliationNote,
      reconciledBy: liveClassAttendanceSummaries.reconciledBy,
      reconciledAt: liveClassAttendanceSummaries.reconciledAt,
    })
    .from(liveClassAttendanceSummaries)
    .where(and(eq(liveClassAttendanceSummaries.sessionId, sessionId), eq(liveClassAttendanceSummaries.userId, computed.userId)))
    .limit(1);

  // A proposal that has been approved or posted is preserved across re-derivation.
  const preserved = existing?.reconciliationState === 'approved' || existing?.reconciliationState === 'posted'
    ? existing.reconciliationState
    : nextState;
  const wasProposed = existing?.reconciliationState === 'proposed' || existing?.reconciliationState === 'approved' || existing?.reconciliationState === 'posted';

  await db.insert(liveClassAttendanceSummaries)
    .values({
      tenantId,
      sessionId,
      userId: computed.userId,
      participantRole: computed.participantRole,
      firstJoinAt: computed.firstJoinAt,
      lastLeaveAt: computed.lastLeaveAt,
      totalPresenceSeconds: computed.totalPresenceSeconds,
      intervals: computed.intervals,
      reconnectCount: computed.reconnectCount,
      lateJoinSeconds: computed.lateJoinSeconds,
      earlyLeaveSeconds: computed.earlyLeaveSeconds,
      status: computed.status,
      reconciliationState: preserved as never,
      reconciliationNote: wasProposed ? existing?.reconciliationNote : (note ?? existing?.reconciliationNote ?? null),
      reconciledBy: ctx?.userId ?? existing?.reconciledBy ?? null,
      reconciledAt: ctx ? now : existing?.reconciledAt ?? null,
      version: (existing?.reconciliationState ? 1 : 0) + 1,
    })
    .onConflictDoUpdate({
      target: [liveClassAttendanceSummaries.sessionId, liveClassAttendanceSummaries.userId],
      set: {
        participantRole: computed.participantRole,
        firstJoinAt: computed.firstJoinAt,
        lastLeaveAt: computed.lastLeaveAt,
        totalPresenceSeconds: computed.totalPresenceSeconds,
        intervals: computed.intervals,
        reconnectCount: computed.reconnectCount,
        lateJoinSeconds: computed.lateJoinSeconds,
        earlyLeaveSeconds: computed.earlyLeaveSeconds,
        status: computed.status,
        reconciliationState: preserved as never,
        reconciliationNote: wasProposed ? existing?.reconciliationNote : (note ?? existing?.reconciliationNote ?? null),
        reconciledBy: ctx?.userId ?? existing?.reconciledBy ?? null,
        reconciledAt: ctx ? now : existing?.reconciledAt ?? null,
        version: (existing?.reconciliationState ? 1 : 0) + 1,
      },
    });
}

export async function reconcileAttendance(
  ctx: RequestContext,
  tenantId: string,
  sessionId: string,
  opts: { note?: string; manual?: Array<{ userId: string; status: SummaryStatus }> },
): Promise<Awaited<ReturnType<typeof getSummaries>>> {
  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');

  if (opts.manual && opts.manual.length > 0 && !opts.note?.trim()) {
    throw new ApiError(422, 'REASON_REQUIRED', 'Une raison est requise pour une réconciliation manuelle.');
  }
  const manualStatuses = new Map((opts.manual ?? []).map(m => [m.userId, m.status]));
  if (opts.manual) {
    for (const m of opts.manual) {
      const [u] = await db.select({ id: user.id }).from(user)
        .where(and(eq(user.id, m.userId), eq(user.tenantId, tenantId))).limit(1);
      if (!u) throw new ApiError(422, 'INVALID_REFERENCE', `Utilisateur inconnu: ${m.userId}.`);
    }
  }

  const computed = await computeSummariesForSession(tenantId, sessionId);
  for (const c of computed) {
    const manualStatus = manualStatuses.get(c.userId);
    await upsertSummary(tenantId, sessionId, { ...c, status: manualStatus ?? c.status }, 'proposed', ctx, opts.note);
  }

  recordAudit(ctx, 'update', 'live_class_session', sessionId, {
    action: 'reconcile', participants: computed.length, manual: opts.manual?.length ?? 0,
  });
  return getSummaries(tenantId, sessionId);
}

// tenantId is REQUIRED (not optional/derived): liveClassAttendanceSummaries
// has no other tenant guard on the read path, so without it any caller with
// live.attendance.read in ANY tenant could read another tenant's attendance
// summaries (names, presence data) by guessing/enumerating a session id
// (found via the P1-9 adversarial suite — this was a real cross-tenant leak).
export async function getSummaries(tenantId: string, sessionId: string) {
  return db
    .select({
      id: liveClassAttendanceSummaries.id,
      userId: liveClassAttendanceSummaries.userId,
      participantRole: liveClassAttendanceSummaries.participantRole,
      firstJoinAt: liveClassAttendanceSummaries.firstJoinAt,
      lastLeaveAt: liveClassAttendanceSummaries.lastLeaveAt,
      totalPresenceSeconds: liveClassAttendanceSummaries.totalPresenceSeconds,
      intervals: liveClassAttendanceSummaries.intervals,
      reconnectCount: liveClassAttendanceSummaries.reconnectCount,
      lateJoinSeconds: liveClassAttendanceSummaries.lateJoinSeconds,
      earlyLeaveSeconds: liveClassAttendanceSummaries.earlyLeaveSeconds,
      status: liveClassAttendanceSummaries.status,
      reconciliationState: liveClassAttendanceSummaries.reconciliationState,
      reconciliationNote: liveClassAttendanceSummaries.reconciliationNote,
      userName: user.name,
    })
    .from(liveClassAttendanceSummaries)
    .leftJoin(user, eq(liveClassAttendanceSummaries.userId, user.id))
    .where(and(eq(liveClassAttendanceSummaries.tenantId, tenantId), eq(liveClassAttendanceSummaries.sessionId, sessionId)))
    .orderBy(liveClassAttendanceSummaries.userId);
}

function toRegisterStatus(status: SummaryStatus): 'present' | 'absent' | 'late' | 'excused' {
  switch (status) {
    case 'present': return 'present';
    case 'late': return 'late';
    case 'early': return 'present';
    case 'absent': return 'absent';
    case 'unknown': return 'absent'; // no evidence of sustained presence
  }
}

export async function postAttendance(
  ctx: RequestContext,
  tenantId: string,
  sessionId: string,
  opts: { note?: string },
): Promise<{ posted: number; skipped: number }> {
  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');

  const summaries = await db.select().from(liveClassAttendanceSummaries)
    .where(and(
      eq(liveClassAttendanceSummaries.sessionId, sessionId),
      inArray(liveClassAttendanceSummaries.reconciliationState, ['proposed', 'approved']),
    ));
  if (summaries.length === 0) {
    throw new ApiError(409, 'NOTHING_TO_POST', 'Aucune présence réconciliée à reporter. Lancez d\'abord une réconciliation.');
  }

  // Which summaries are STUDENTS is determined from the authoritative user
  // role, never from participantRole: participantRole is the provider JOIN
  // role (moderator/viewer) — a student, a parent, and a non-host teacher can
  // all join as 'viewer', and a host teacher or admin joins as 'moderator'.
  // It can never reliably answer "is this a student" (a stale filter on it
  // here previously meant nothing was ever posted, since real join/webhook
  // events never carry the academic role 'student').
  const summaryUserIds = summaries.map(s => s.userId);
  const studentUserIds = summaryUserIds.length === 0
    ? []
    : await db.select({ id: user.id }).from(user)
      .where(and(eq(user.tenantId, tenantId), inArray(user.id, summaryUserIds), eq(user.role, 'student')));
  const studentIdSet = new Set(studentUserIds.map(r => r.id));
  const students = summaries.filter(s => studentIdSet.has(s.userId));
  const skipped = summaries.length - students.length + students.filter(s => s.status === 'unknown').length;

  if (students.length > 0) {
    const [section] = await db.select({ classId: classSections.classId }).from(classSections)
      .where(and(eq(classSections.id, session.classSectionId!), eq(classSections.tenantId, tenantId))).limit(1);
    if (!section) throw new ApiError(422, 'INVALID_REFERENCE', 'La classe de cette session est introuvable.');

    const date = session.scheduledStart.slice(0, 10);
    const register = await resolveRegisterForSubmission(tenantId, section.classId, date, REGISTER_PERIOD, ctx.userId, opts.note, db);

    for (const s of students) {
      if (s.status === 'unknown') continue; // leave unknown for manual review
      const status = toRegisterStatus(s.status as SummaryStatus);
      await db.delete(attendance).where(and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, s.userId),
        eq(attendance.date, date),
        eq(attendance.period, REGISTER_PERIOD),
      ));
      await db.insert(attendance).values({
        tenantId,
        studentId: s.userId,
        studentGroupId: section.classId,
        subjectId: null,
        period: REGISTER_PERIOD,
        date,
        status,
        lateMinutes: status === 'late' ? Math.max(0, s.lateJoinSeconds) : null,
        markedById: ctx.userId,
        note: `Classe virtuelle: ${session.title}${opts.note ? ` — ${opts.note}` : ''}`,
        isVoided: false,
        registerId: register.id,
      });
      await recalculateStudentAttendanceSummary(tenantId, s.userId);
      await detectAndRecordFlags(tenantId, s.userId, date, status);
    }
  }

  const now = new Date().toISOString();
  await db.update(liveClassAttendanceSummaries)
    .set({ reconciliationState: 'posted', reconciledBy: ctx.userId, reconciledAt: now })
    .where(and(
      eq(liveClassAttendanceSummaries.sessionId, sessionId),
      inArray(liveClassAttendanceSummaries.reconciliationState, ['proposed', 'approved']),
    ));

  recordAudit(ctx, 'update', 'live_class_session', sessionId, {
    action: 'post_attendance', posted: students.length, skipped,
  });
  return { posted: students.length, skipped };
}
