// Live Classrooms reporting.
//
// Reports are computed from normalized Lango rows (sessions, invitations,
// participant events, derived attendance summaries, recordings) — never from
// fabricated metrics. Provider-specific signals are labeled as such; no
// synthetic engagement scores are invented.
import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  classSections, classes, liveClassAttendanceSummaries, liveClassInvitations,
  liveClassParticipantEvents, liveClassProviderProfiles, liveClassRecordings,
  liveClassSessions, sections, subjects, classSubjects, user,
} from '@/models/Schema';

export type ReportFilters = {
  from?: string; // ISO scheduled-start lower bound
  to?: string; // ISO scheduled-start upper bound
  teacherUserId?: string;
  classSectionId?: string;
  providerProfileId?: string;
};

function buildWhere(tenantId: string, filters: ReportFilters = {}): SQL[] {
  const where: SQL[] = [eq(liveClassSessions.tenantId, tenantId)];
  if (filters.from) where.push(sql`${liveClassSessions.scheduledStart} >= ${filters.from}`);
  if (filters.to) where.push(sql`${liveClassSessions.scheduledStart} <= ${filters.to}`);
  if (filters.teacherUserId) where.push(eq(liveClassSessions.teacherUserId, filters.teacherUserId));
  if (filters.classSectionId) where.push(eq(liveClassSessions.classSectionId, filters.classSectionId));
  if (filters.providerProfileId) where.push(eq(liveClassSessions.providerProfileId, filters.providerProfileId));
  return where;
}

export async function getOverview(tenantId: string, filters: ReportFilters = {}) {
  const where = buildWhere(tenantId, filters);

  const [sessionCount] = await db
    .select({ value: count() })
    .from(liveClassSessions)
    .where(and(...where));
  const [endedCount] = await db
    .select({ value: count() })
    .from(liveClassSessions)
    .where(and(...where, eq(liveClassSessions.status, 'ended')));
  const [failedCount] = await db
    .select({ value: count() })
    .from(liveClassSessions)
    .where(and(...where, eq(liveClassSessions.status, 'failed')));
  const [cancelledCount] = await db
    .select({ value: count() })
    .from(liveClassSessions)
    .where(and(...where, eq(liveClassSessions.status, 'cancelled')));

  // Sessions with at least one reconciled summary.
  const [withAttendance] = await db
    .select({ value: count() })
    .from(liveClassSessions)
    .innerJoin(liveClassAttendanceSummaries, eq(liveClassAttendanceSummaries.sessionId, liveClassSessions.id))
    .where(and(...where, eq(liveClassAttendanceSummaries.tenantId, tenantId)));

  // Average presence ratio across all summaries (presence seconds / planned duration).
  const [avgPresence] = await db
    .select({ value: sql<number>`COALESCE(AVG(
      CASE WHEN ${liveClassAttendanceSummaries.totalPresenceSeconds} > 0 THEN 1 ELSE 0 END
    ), 0)::float8` })
    .from(liveClassAttendanceSummaries)
    .innerJoin(liveClassSessions, eq(liveClassSessions.id, liveClassAttendanceSummaries.sessionId))
    .where(and(eq(liveClassAttendanceSummaries.tenantId, tenantId), ...where));

  const [recordingsCount] = await db
    .select({ value: count() })
    .from(liveClassRecordings)
    .innerJoin(liveClassSessions, eq(liveClassSessions.id, liveClassRecordings.sessionId))
    .where(and(
      eq(liveClassRecordings.tenantId, tenantId),
      eq(liveClassRecordings.state, 'ready'),
      ...where,
    ));

  const [joinedCount] = await db
    .select({ value: count() })
    .from(liveClassParticipantEvents)
    .innerJoin(liveClassSessions, eq(liveClassSessions.id, liveClassParticipantEvents.sessionId))
    .where(and(
      eq(liveClassParticipantEvents.tenantId, tenantId),
      eq(liveClassParticipantEvents.eventType, 'joined'),
      ...where,
    ));

  const [invitedCount] = await db
    .select({ value: count() })
    .from(liveClassInvitations)
    .innerJoin(liveClassSessions, eq(liveClassSessions.id, liveClassInvitations.sessionId))
    .where(and(eq(liveClassInvitations.tenantId, tenantId), ...where));

  return {
    totalSessions: Number(sessionCount?.value ?? 0),
    endedSessions: Number(endedCount?.value ?? 0),
    failedSessions: Number(failedCount?.value ?? 0),
    cancelledSessions: Number(cancelledCount?.value ?? 0),
    sessionsWithAttendance: Number(withAttendance?.value ?? 0),
    presenceRate: Number(avgPresence?.value ?? 0),
    readyRecordings: Number(recordingsCount?.value ?? 0),
    joinedEvents: Number(joinedCount?.value ?? 0),
    invitedCount: Number(invitedCount?.value ?? 0),
  };
}

export type SessionReportRow = {
  id: string;
  title: string;
  status: string;
  providerType: string | null;
  teacherName: string | null;
  className: string | null;
  sectionName: string | null;
  subjectName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  invited: number;
  joined: number;
  present: number;
  late: number;
  early: number;
  absent: number;
  unknown: number;
  reconnects: number;
  recordings: number;
};

export async function listSessionReports(tenantId: string, filters: ReportFilters = {}): Promise<SessionReportRow[]> {
  const where = buildWhere(tenantId, filters);

  const sessions = await db
    .select({
      id: liveClassSessions.id,
      title: liveClassSessions.title,
      status: liveClassSessions.status,
      providerType: liveClassProviderProfiles.providerType,
      teacherName: user.name,
      className: classes.name,
      sectionName: sections.name,
      subjectName: subjects.name,
      scheduledStart: liveClassSessions.scheduledStart,
      scheduledEnd: liveClassSessions.scheduledEnd,
      actualStart: liveClassSessions.actualStart,
      actualEnd: liveClassSessions.actualEnd,
    })
    .from(liveClassSessions)
    .leftJoin(liveClassProviderProfiles, eq(liveClassSessions.providerProfileId, liveClassProviderProfiles.id))
    .leftJoin(user, eq(liveClassSessions.teacherUserId, user.id))
    .leftJoin(classSections, eq(liveClassSessions.classSectionId, classSections.id))
    .leftJoin(classes, eq(classSections.classId, classes.id))
    .leftJoin(sections, eq(classSections.sectionId, sections.id))
    .leftJoin(classSubjects, eq(liveClassSessions.classSubjectId, classSubjects.id))
    .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(and(...where))
    .orderBy(desc(liveClassSessions.scheduledStart));

  if (sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);

  const [invitedRows, joinedRows, summaryRows, recordingRows] = await Promise.all([
    db.select({ sessionId: liveClassInvitations.sessionId, value: count() })
      .from(liveClassInvitations)
      .where(and(eq(liveClassInvitations.tenantId, tenantId), sql`${liveClassInvitations.sessionId} IN (${sql.join(sessionIds, sql`, `)})`))
      .groupBy(liveClassInvitations.sessionId),
    db.select({ sessionId: liveClassParticipantEvents.sessionId, value: count() })
      .from(liveClassParticipantEvents)
      .where(and(eq(liveClassParticipantEvents.tenantId, tenantId), eq(liveClassParticipantEvents.eventType, 'joined'), sql`${liveClassParticipantEvents.sessionId} IN (${sql.join(sessionIds, sql`, `)})`))
      .groupBy(liveClassParticipantEvents.sessionId),
    db.select({
      sessionId: liveClassAttendanceSummaries.sessionId,
      present: sql<number>`count(*) FILTER (WHERE ${liveClassAttendanceSummaries.status} IN ('present','late','early'))::int`,
      late: sql<number>`count(*) FILTER (WHERE ${liveClassAttendanceSummaries.status} = 'late')::int`,
      early: sql<number>`count(*) FILTER (WHERE ${liveClassAttendanceSummaries.status} = 'early')::int`,
      absent: sql<number>`count(*) FILTER (WHERE ${liveClassAttendanceSummaries.status} = 'absent')::int`,
      unknown: sql<number>`count(*) FILTER (WHERE ${liveClassAttendanceSummaries.status} = 'unknown')::int`,
      reconnects: sql<number>`COALESCE(SUM(${liveClassAttendanceSummaries.reconnectCount}), 0)::int`,
    })
      .from(liveClassAttendanceSummaries)
      .where(and(eq(liveClassAttendanceSummaries.tenantId, tenantId), sql`${liveClassAttendanceSummaries.sessionId} IN (${sql.join(sessionIds, sql`, `)})`))
      .groupBy(liveClassAttendanceSummaries.sessionId),
    db.select({ sessionId: liveClassRecordings.sessionId, value: count() })
      .from(liveClassRecordings)
      .where(and(eq(liveClassRecordings.tenantId, tenantId), eq(liveClassRecordings.state, 'ready'), sql`${liveClassRecordings.sessionId} IN (${sql.join(sessionIds, sql`, `)})`))
      .groupBy(liveClassRecordings.sessionId),
  ]);

  const invitedMap = new Map(invitedRows.map(r => [r.sessionId, Number(r.value)]));
  const joinedMap = new Map(joinedRows.map(r => [r.sessionId, Number(r.value)]));
  const summaryMap = new Map(summaryRows.map(r => [r.sessionId, r]));
  const recordingsMap = new Map(recordingRows.map(r => [r.sessionId, Number(r.value)]));

  return sessions.map(s => {
    const sum = summaryMap.get(s.id);
    return {
      ...s,
      invited: invitedMap.get(s.id) ?? 0,
      joined: joinedMap.get(s.id) ?? 0,
      present: Number(sum?.present ?? 0),
      late: Number(sum?.late ?? 0),
      early: Number(sum?.early ?? 0),
      absent: Number(sum?.absent ?? 0),
      unknown: Number(sum?.unknown ?? 0),
      reconnects: Number(sum?.reconnects ?? 0),
      recordings: recordingsMap.get(s.id) ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportSessionReportsCsv(tenantId: string, filters: ReportFilters = {}) {
  const rows = await listSessionReports(tenantId, filters);
  const header = [
    'ID', 'Titre', 'Statut', 'Fournisseur', 'Enseignant', 'Classe', 'Section',
    'Matière', 'Début planifié', 'Fin planifiée', 'Début réel', 'Fin réelle',
    'Invités', 'Connectés', 'Présents', 'En retard', 'En avance', 'Absents',
    'Inconnus', 'Reconnexions', 'Enregistrements',
  ];
  const lines = rows.map(r => [
    r.id, r.title, r.status, r.providerType ?? '', r.teacherName ?? '',
    r.className ?? '', r.sectionName ?? '', r.subjectName ?? '',
    r.scheduledStart, r.scheduledEnd, r.actualStart ?? '', r.actualEnd ?? '',
    r.invited, r.joined, r.present, r.late, r.early, r.absent, r.unknown,
    r.reconnects, r.recordings,
  ].map(csvEscape).join(','));
  return [header.map(csvEscape).join(','), ...lines].join('\n');
}
