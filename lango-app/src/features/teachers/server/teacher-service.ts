/**
 * Teacher domain service — the single authoritative layer for teacher
 * directory reads, onboarding, updates and lifecycle transitions.
 *
 * Teacher identity is a `user` row with role='teacher' (no separate teachers
 * table). This service owns:
 *   - branch/tenant scope resolution for every teacher operation
 *   - the directory projection (minimum necessary fields — no salary, RIB,
 *     CNSS, national id or bank data in the list)
 *   - current vs historical academic assignments
 *   - planned weekly workload from the published timetable
 *   - dossier completeness
 *   - safe lifecycle: deactivate/archive preserve history; hard delete is only
 *     permitted for a teacher with zero academic/HR dependencies.
 */

import type { TeacherDossier } from './teacher-dossier';
import type { TeacherWorkloadSummary } from './teacher-workload';
import type { RequestContext } from '@/libs/api/context';
import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { reserveEmployeeId } from '@/features/hr/services/employee-id';
import { ApiError } from '@/libs/api/errors';
import { hasCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { generateSetupToken, hashSetupToken, SETUP_TOKEN_TTL_MS } from '@/libs/setup-token';
import { normalizeMoroccanPhone } from '@/libs/sms/moroccan-sms-adapter';
import {
  academicClassOfferings,
  account,
  accountSetupTokens,
  attendance,
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  classTeachers,
  employeeProfiles,
  meetingSlots,
  sections,
  sessionYears,
  smsMessages,
  subjects,
  subjectTeachers,
  teacherAvailability,
  timetableSlots,
  timetableVersions,
  user,
} from '@/models/Schema';
import { toDbStatus } from '@/models/userMapping';
import { computeTeacherDossier, summarizeTeacherDossiers } from './teacher-dossier';
import { summarizeWorkload, sumWeeklyHours } from './teacher-workload';

export type TeacherStatus = 'active' | 'inactive' | 'archived';
export type TeacherStatusFilter = TeacherStatus | 'all';

export type TeacherDirectorySubject = { id: string; name: string };
export type TeacherDirectoryClass = { id: string; label: string; role: string };

export type TeacherDirectoryItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  specialization: string;
  branchId: string | null;
  branchName: string | null;
  status: TeacherStatus;
  avatarUrl?: string;
  subjects: TeacherDirectorySubject[];
  classes: TeacherDirectoryClass[];
  /** null when the teacher has no published timetable slot (not "0 hours"). */
  weeklyScheduledHours: number | null;
  dossier: TeacherDossier;
  /** False when any academic/HR history references this teacher. */
  canHardDelete: boolean;
};

export type TeacherListFilters = {
  search?: string | null;
  status?: string | null;
  subjectId?: string | null;
  classSectionId?: string | null;
  branchId?: string | null;
  page: number;
  pageSize: number;
};

export type TeacherListResult = {
  items: TeacherDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: TeacherDirectorySummary;
  /** The single resolved scope used by items + summary + export. */
  scope: TeacherScopeInfo;
};

export type TeacherAttentionItem = {
  id: string;
  name: string;
  missingItems: string[];
};

export type TeacherDirectorySummary = {
  scopedTeachers: number;
  activeTeachers: number;
  onLeave: number;
  dossiers: ReturnType<typeof summarizeTeacherDossiers>;
  workload: TeacherWorkloadSummary;
  /** Up to 3 incomplete dossiers in scope, most incomplete first. */
  attention: TeacherAttentionItem[];
};

export type TeacherEmploymentSummary = {
  contractType: string | null;
  employmentType: string | null;
  employmentStatus: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  hireDate: string | null;
};

export type TeacherSensitiveHr = {
  salary: string | null;
  nationalId: string | null;
  address: string | null;
  city: string | null;
  dateOfBirth: string | null;
  bankRib: string | null;
  cnssNumber: string | null;
  amoNumber: string | null;
};

export type TeacherClassAssignmentHistoryItem = {
  id: string;
  classSectionId: string;
  label: string;
  role: string;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  isCurrent: boolean;
  studentCount: number;
};

export type TeacherSubjectAssignmentItem = {
  id: string;
  subjectId: string;
  subjectName: string;
  classSectionId: string;
  classLabel: string;
  offeringId: string | null;
  isCurrent: boolean;
};

export type TeacherDependency = { key: string; count: number };

export type TeacherDetail = TeacherDirectoryItem & {
  firstName: string | null;
  lastName: string | null;
  cycle: string;
  qualification: string | null;
  hireDate: string | null;
  createdAt: string;
  lastLogin: string | null;
  documents: { contract: boolean; cin: boolean; diploma: boolean };
  employment: TeacherEmploymentSummary | null;
  /** Present only when the caller holds hr.sensitive.read. */
  sensitiveHr: TeacherSensitiveHr | null;
  sensitiveRedacted: boolean;
  classAssignments: TeacherClassAssignmentHistoryItem[];
  subjectAssignments: TeacherSubjectAssignmentItem[];
  canHardDelete: boolean;
  dependencies: TeacherDependency[];
};

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

/** Today in YYYY-MM-DD — the cut-off for "current" assignments. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The single authoritative view scope for one teacher-directory request.
 *
 * The effective scope is resolved once and then used by EVERY read surface:
 * list, KPIs, dossier summary, workload, filter options and export. This is
 * what prevents the previous contradiction (topbar showing a campus while the
 * directory silently queried all campuses).
 *
 * Rules:
 *   - A branch-limited principal is always pinned to their home branch; asking
 *     for another branch is a 403.
 *   - A whole-school principal (branchId null) may select one validated branch
 *     of their tenant, or none = institution-wide.
 *   - A branch id that does not exist in the tenant is refused (422) — browser
 *     input is never trusted.
 */
export type TeacherScopeInfo = {
  /** The viewer's own branch assignment (null = whole-school). */
  homeBranchId: string | null;
  /** The branch every query in this request is narrowed to (null = all). */
  effectiveBranchId: string | null;
  branchName: string | null;
  allBranches: boolean;
};

async function branchNameInTenant(tenantId: string, branchId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: branches.name })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
    .limit(1);
  return row?.name ?? null;
}

export async function resolveTeacherScope(
  viewer: RequestContext,
  tenantId: string,
  requestedBranchId?: string | null,
): Promise<TeacherScopeInfo> {
  const requested = requestedBranchId && requestedBranchId !== 'all' ? requestedBranchId : null;

  if (viewer.branchId) {
    if (requested && requested !== viewer.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez pas accéder aux enseignants d\'un autre campus.');
    }
    return {
      homeBranchId: viewer.branchId,
      effectiveBranchId: viewer.branchId,
      branchName: await branchNameInTenant(tenantId, viewer.branchId),
      allBranches: false,
    };
  }

  if (requested) {
    const branchName = await branchNameInTenant(tenantId, requested);
    if (!branchName) {
      throw new ApiError(422, 'INVALID_BRANCH', 'Le campus sélectionné n\'existe pas pour cet établissement.');
    }
    return { homeBranchId: null, effectiveBranchId: requested, branchName, allBranches: false };
  }

  return { homeBranchId: null, effectiveBranchId: null, branchName: null, allBranches: true };
}

function teacherBaseConditions(tenantId: string, effectiveBranchId: string | null) {
  const conditions = [eq(user.tenantId, tenantId), eq(user.role, 'teacher')];
  if (effectiveBranchId) {
    conditions.push(eq(user.branchId, effectiveBranchId));
  }
  return conditions;
}

/**
 * A teacher the caller is allowed to see; null when out of scope (404 upstream).
 * `effectiveBranchId` narrows to the selected view scope when provided
 * (directory detail); omitted, the viewer's home scope applies.
 */
export async function findScopedTeacher(
  viewer: RequestContext,
  tenantId: string,
  id: string,
  effectiveBranchId?: string | null,
) {
  const branch = effectiveBranchId === undefined ? viewer.branchId : effectiveBranchId;
  const [row] = await db
    .select()
    .from(user)
    .where(and(...teacherBaseConditions(tenantId, branch), eq(user.id, id)))
    .limit(1);
  return row ?? null;
}

function scopedTeacherIdsSubquery(tenantId: string, effectiveBranchId: string | null) {
  return db.select({ id: user.id }).from(user).where(and(...teacherBaseConditions(tenantId, effectiveBranchId)));
}

// ---------------------------------------------------------------------------
// Current assignment + workload helpers
// ---------------------------------------------------------------------------

function isCurrentOffering(offeringSessionYearId: string | null, defaultSessionYearId: string | null): boolean {
  // offeringId is optional in the current data model: a null offering means
  // "not year-scoped" and is treated as current. A concrete offering is
  // current only when its session year is the tenant's default year.
  if (!offeringSessionYearId) {
    return true;
  }
  return defaultSessionYearId !== null && offeringSessionYearId === defaultSessionYearId;
}

export async function getDefaultSessionYearId(tenantId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: sessionYears.id })
    .from(sessionYears)
    .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
    .limit(1);
  return row?.id ?? null;
}

export async function getPublishedVersionId(tenantId: string): Promise<string | null> {
  const sessionYearId = await getDefaultSessionYearId(tenantId);
  if (!sessionYearId) {
    return null;
  }
  const [row] = await db
    .select({ id: timetableVersions.id })
    .from(timetableVersions)
    .where(and(
      eq(timetableVersions.tenantId, tenantId),
      eq(timetableVersions.sessionYearId, sessionYearId),
      eq(timetableVersions.status, 'published'),
    ))
    .orderBy(desc(timetableVersions.createdAt))
    .limit(1);
  return row?.id ?? null;
}

/** Current scheduled weekly hours per teacher, from the published timetable. */
export async function scheduledHoursByTeacher(tenantId: string, teacherIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (teacherIds.length === 0) {
    return map;
  }
  const versionId = await getPublishedVersionId(tenantId);
  if (!versionId) {
    return map;
  }
  const rows = await db
    .select({ teacherId: classScheduleSlots.teacherId, startTime: classScheduleSlots.startTime, endTime: classScheduleSlots.endTime })
    .from(classScheduleSlots)
    .where(and(
      eq(classScheduleSlots.tenantId, tenantId),
      eq(classScheduleSlots.versionId, versionId),
      inArray(classScheduleSlots.teacherId, teacherIds),
    ));

  const grouped = new Map<string, { startTime: string; endTime: string }[]>();
  for (const row of rows) {
    const list = grouped.get(row.teacherId) ?? [];
    list.push({ startTime: row.startTime, endTime: row.endTime });
    grouped.set(row.teacherId, list);
  }
  for (const [teacherId, slots] of grouped) {
    map.set(teacherId, sumWeeklyHours(slots));
  }
  return map;
}

async function currentSubjectsByTeacher(tenantId: string, teacherIds: string[], defaultSessionYearId: string | null) {
  const map = new Map<string, TeacherDirectorySubject[]>();
  if (teacherIds.length === 0) {
    return map;
  }
  const rows = await db
    .select({
      teacherId: subjectTeachers.teacherId,
      subjectId: subjects.id,
      subjectName: subjects.name,
      isActive: classSubjects.isActive,
      offeringSessionYearId: academicClassOfferings.sessionYearId,
    })
    .from(subjectTeachers)
    .innerJoin(subjects, eq(subjectTeachers.subjectId, subjects.id))
    .innerJoin(classSubjects, eq(subjectTeachers.classSubjectId, classSubjects.id))
    .leftJoin(academicClassOfferings, eq(subjectTeachers.offeringId, academicClassOfferings.id))
    .where(and(
      eq(subjectTeachers.tenantId, tenantId),
      inArray(subjectTeachers.teacherId, teacherIds),
    ));

  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.isActive) {
      continue;
    }
    if (!isCurrentOffering(row.offeringSessionYearId, defaultSessionYearId)) {
      continue;
    }
    const key = `${row.teacherId}|${row.subjectId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const list = map.get(row.teacherId) ?? [];
    list.push({ id: row.subjectId, name: row.subjectName });
    map.set(row.teacherId, list);
  }
  return map;
}

async function currentClassesByTeacher(tenantId: string, teacherIds: string[], defaultSessionYearId: string | null) {
  const map = new Map<string, TeacherDirectoryClass[]>();
  if (teacherIds.length === 0) {
    return map;
  }
  const today = todayIso();
  const rows = await db
    .select({
      teacherId: classTeachers.teacherId,
      classSectionId: classTeachers.classSectionId,
      role: classTeachers.role,
      className: classes.name,
      sectionName: sections.name,
      offeringSessionYearId: academicClassOfferings.sessionYearId,
    })
    .from(classTeachers)
    .innerJoin(classSections, eq(classTeachers.classSectionId, classSections.id))
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .leftJoin(academicClassOfferings, eq(classTeachers.offeringId, academicClassOfferings.id))
    .where(and(
      eq(classTeachers.tenantId, tenantId),
      inArray(classTeachers.teacherId, teacherIds),
      eq(classTeachers.status, 'active'),
      or(isNull(classTeachers.endsOn), gte(classTeachers.endsOn, today))!,
    ));

  for (const row of rows) {
    if (!isCurrentOffering(row.offeringSessionYearId, defaultSessionYearId)) {
      continue;
    }
    const list = map.get(row.teacherId) ?? [];
    list.push({ id: row.classSectionId, label: `${row.className} ${row.sectionName}`.trim(), role: row.role });
    map.set(row.teacherId, list);
  }
  return map;
}

async function branchNamesById(tenantId: string, branchIds: string[]) {
  const map = new Map<string, string>();
  const unique = [...new Set(branchIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) {
    return map;
  }
  const rows = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(eq(branches.tenantId, tenantId), inArray(branches.id, unique)));
  for (const row of rows) {
    map.set(row.id, row.name);
  }
  return map;
}

function asDocumentFlags(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function toDirectoryItem(
  row: typeof user.$inferSelect,
  opts: {
    subjects: TeacherDirectorySubject[];
    classes: TeacherDirectoryClass[];
    weeklyScheduledHours: number | null;
    branchName: string | null;
    canHardDelete: boolean;
  },
): TeacherDirectoryItem {
  const documents = asDocumentFlags(row.documents);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? '',
    employeeId: row.employeeId ?? '',
    specialization: row.specialization ?? '',
    branchId: row.branchId,
    branchName: opts.branchName,
    status: row.userStatus as TeacherStatus,
    avatarUrl: row.photoUrl ? `/api/teachers/photo?id=${row.id}` : undefined,
    subjects: opts.subjects,
    classes: opts.classes,
    weeklyScheduledHours: opts.weeklyScheduledHours,
    dossier: computeTeacherDossier({
      documents,
      employeeId: row.employeeId,
      hireDate: row.hireDate,
      specialization: row.specialization,
    }),
    canHardDelete: opts.canHardDelete,
  };
}

/**
 * One bounded query returning which of the given teachers have ANY
 * dependency row (assignments, timetable, attendance/grade authorship, HR
 * profile, login account). Used by the directory to expose hard delete only
 * for clean records.
 */
async function teachersWithDependencies(tenantId: string, teacherIds: string[]): Promise<Set<string>> {
  if (teacherIds.length === 0) {
    return new Set();
  }
  const idList = sql.join(teacherIds.map(id => sql`${id}`), sql`, `);
  const result = await db.execute(sql`
    select distinct t.teacher_id as teacher_id
    from (
      select teacher_id from class_teachers where tenant_id = ${tenantId} and teacher_id in (${idList})
      union all select teacher_id from subject_teachers where tenant_id = ${tenantId} and teacher_id in (${idList})
      union all select teacher_id from class_schedule_slots where tenant_id = ${tenantId} and teacher_id in (${idList})
      union all select teacher_id from timetable_slots where tenant_id = ${tenantId} and teacher_id in (${idList})
      union all select teacher_id from teacher_availability where tenant_id = ${tenantId} and teacher_id in (${idList})
      union all select teacher_id from meeting_slots where tenant_id = ${tenantId} and teacher_id in (${idList})
      union all select marked_by_id as teacher_id from attendance where tenant_id = ${tenantId} and marked_by_id in (${idList})
      union all select marker_id as teacher_id from assessment_outcomes where tenant_id = ${tenantId} and marker_id in (${idList})
      union all select created_by as teacher_id from assessment_definitions where tenant_id = ${tenantId} and created_by in (${idList})
      union all select user_id as teacher_id from employee_profiles where tenant_id = ${tenantId} and user_id in (${idList})
      union all select user_id as teacher_id from account where user_id in (${idList})
    ) t
    where t.teacher_id is not null
  `);
  const rows = (result.rows ?? []) as { teacher_id?: string | null }[];
  const set = new Set<string>();
  for (const row of rows) {
    if (row.teacher_id) {
      set.add(row.teacher_id);
    }
  }
  return set;
}

async function hydrateDirectoryItems(tenantId: string, rows: (typeof user.$inferSelect)[]): Promise<TeacherDirectoryItem[]> {
  const teacherIds = rows.map(row => row.id);
  const defaultSessionYearId = await getDefaultSessionYearId(tenantId);
  const [subjectsByTeacher, classesByTeacher, hoursByTeacher, branchNames, withDependencies] = await Promise.all([
    currentSubjectsByTeacher(tenantId, teacherIds, defaultSessionYearId),
    currentClassesByTeacher(tenantId, teacherIds, defaultSessionYearId),
    scheduledHoursByTeacher(tenantId, teacherIds),
    branchNamesById(tenantId, rows.map(row => row.branchId).filter((id): id is string => Boolean(id))),
    teachersWithDependencies(tenantId, teacherIds),
  ]);

  return rows.map(row => toDirectoryItem(row, {
    subjects: subjectsByTeacher.get(row.id) ?? [],
    classes: classesByTeacher.get(row.id) ?? [],
    weeklyScheduledHours: hoursByTeacher.has(row.id) ? hoursByTeacher.get(row.id)! : null,
    branchName: row.branchId ? branchNames.get(row.branchId) ?? null : null,
    canHardDelete: !withDependencies.has(row.id),
  }));
}

// ---------------------------------------------------------------------------
// List + summary
// ---------------------------------------------------------------------------

function buildListConditions(tenantId: string, effectiveBranchId: string | null, filters: TeacherListFilters) {
  const conditions = teacherBaseConditions(tenantId, effectiveBranchId);

  const search = filters.search?.trim();
  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        ilike(user.name, term),
        ilike(user.employeeId, term),
        ilike(user.email, term),
        ilike(user.phone, term),
        ilike(user.specialization, term),
      )!,
    );
  }

  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(user.userStatus, filters.status as TeacherStatus));
  }

  if (filters.subjectId) {
    conditions.push(inArray(
      user.id,
      db.select({ id: subjectTeachers.teacherId })
        .from(subjectTeachers)
        .where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.subjectId, filters.subjectId))),
    ));
  }

  if (filters.classSectionId) {
    conditions.push(inArray(
      user.id,
      db.select({ id: classTeachers.teacherId })
        .from(classTeachers)
        .where(and(eq(classTeachers.tenantId, tenantId), eq(classTeachers.classSectionId, filters.classSectionId))),
    ));
  }

  return conditions;
}

export async function listTeachers(viewer: RequestContext, tenantId: string, filters: TeacherListFilters): Promise<TeacherListResult> {
  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1;
  const pageSize = Number.isFinite(filters.pageSize) && filters.pageSize > 0 ? Math.min(Math.floor(filters.pageSize), 100) : 20;
  // Resolved once; every surface below receives the same effective branch.
  const scope = await resolveTeacherScope(viewer, tenantId, filters.branchId);
  const conditions = buildListConditions(tenantId, scope.effectiveBranchId, filters);
  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(user)
      .where(where)
      // Deterministic ordering: name then primary key, so pagination is stable.
      .orderBy(asc(user.name), asc(user.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(user).where(where),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);
  const [items, summary] = await Promise.all([
    hydrateDirectoryItems(tenantId, rows),
    teacherDirectorySummary(tenantId, scope.effectiveBranchId),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary,
    scope,
  };
}

/**
 * Institution-wide KPIs, computed independently of the current page/filters so
 * filters never silently change what "Enseignants actifs" means. All counts
 * respect the caller's branch scope.
 */
export async function teacherDirectorySummary(tenantId: string, effectiveBranchId: string | null): Promise<TeacherDirectorySummary> {
  const scope = teacherBaseConditions(tenantId, effectiveBranchId);

  const [allRows, onLeaveRows] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        userStatus: user.userStatus,
        documents: user.documents,
        employeeId: user.employeeId,
        hireDate: user.hireDate,
        specialization: user.specialization,
      })
      .from(user)
      .where(and(...scope)),
    db
      .select({ id: user.id, count: count() })
      .from(user)
      .innerJoin(employeeProfiles, eq(employeeProfiles.userId, user.id))
      .where(and(
        ...scope,
        eq(employeeProfiles.tenantId, tenantId),
        eq(employeeProfiles.employmentStatus, 'on_leave'),
      ))
      .groupBy(user.id),
  ]);

  const computed = allRows.map(row => ({
    row,
    dossier: computeTeacherDossier({
      documents: asDocumentFlags(row.documents),
      employeeId: row.employeeId,
      hireDate: row.hireDate,
      specialization: row.specialization,
    }),
  }));
  const dossiers = computed.map(entry => entry.dossier);

  const attention: TeacherAttentionItem[] = computed
    .filter(entry => !entry.dossier.complete)
    .sort((a, b) => b.dossier.missingItems.length - a.dossier.missingItems.length)
    .slice(0, 3)
    .map(entry => ({ id: entry.row.id, name: entry.row.name, missingItems: entry.dossier.missingItems }));

  const activeTeacherIds = allRows.filter(row => row.userStatus === 'active').map(row => row.id);
  const hoursByTeacher = await scheduledHoursByTeacher(tenantId, activeTeacherIds);
  let totalHours = 0;
  let scheduledTeachers = 0;
  for (const hours of hoursByTeacher.values()) {
    totalHours += hours;
    scheduledTeachers += 1;
  }

  return {
    scopedTeachers: allRows.length,
    activeTeachers: activeTeacherIds.length,
    onLeave: onLeaveRows.length,
    dossiers: summarizeTeacherDossiers(dossiers),
    workload: summarizeWorkload(totalHours, scheduledTeachers, activeTeacherIds.length),
    attention,
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

async function teacherDependencyCounts(tenantId: string, teacherId: string): Promise<TeacherDependency[]> {
  const [classTeacherRows, subjectTeacherRows, scheduleRows, legacyScheduleRows, availabilityRows, meetingRows, attendanceRows, outcomeRows, definitionRows, profileRows, accountRows] = await Promise.all([
    db.select({ n: count() }).from(classTeachers).where(and(eq(classTeachers.tenantId, tenantId), eq(classTeachers.teacherId, teacherId))),
    db.select({ n: count() }).from(subjectTeachers).where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.teacherId, teacherId))),
    db.select({ n: count() }).from(classScheduleSlots).where(and(eq(classScheduleSlots.tenantId, tenantId), eq(classScheduleSlots.teacherId, teacherId))),
    db.select({ n: count() }).from(timetableSlots).where(and(eq(timetableSlots.tenantId, tenantId), eq(timetableSlots.teacherId, teacherId))),
    db.select({ n: count() }).from(teacherAvailability).where(and(eq(teacherAvailability.tenantId, tenantId), eq(teacherAvailability.teacherId, teacherId))),
    db.select({ n: count() }).from(meetingSlots).where(and(eq(meetingSlots.tenantId, tenantId), eq(meetingSlots.teacherId, teacherId))),
    db.select({ n: count() }).from(attendance).where(and(eq(attendance.tenantId, tenantId), eq(attendance.markedById, teacherId))),
    db.select({ n: count() }).from(assessmentOutcomes).where(and(eq(assessmentOutcomes.tenantId, tenantId), eq(assessmentOutcomes.markerId, teacherId))),
    db.select({ n: count() }).from(assessmentDefinitions).where(and(eq(assessmentDefinitions.tenantId, tenantId), eq(assessmentDefinitions.createdBy, teacherId))),
    db.select({ n: count() }).from(employeeProfiles).where(and(eq(employeeProfiles.tenantId, tenantId), eq(employeeProfiles.userId, teacherId))),
    db.select({ n: count() }).from(account).where(eq(account.userId, teacherId)),
  ]);

  const dependencies: TeacherDependency[] = [
    { key: 'class_assignments', count: Number(classTeacherRows[0]?.n ?? 0) },
    { key: 'subject_assignments', count: Number(subjectTeacherRows[0]?.n ?? 0) },
    { key: 'timetable_slots', count: Number(scheduleRows[0]?.n ?? 0) },
    { key: 'legacy_timetable_slots', count: Number(legacyScheduleRows[0]?.n ?? 0) },
    { key: 'teacher_availability', count: Number(availabilityRows[0]?.n ?? 0) },
    { key: 'meeting_slots', count: Number(meetingRows[0]?.n ?? 0) },
    { key: 'attendance_records_marked', count: Number(attendanceRows[0]?.n ?? 0) },
    { key: 'grade_records_marked', count: Number(outcomeRows[0]?.n ?? 0) },
    { key: 'assessments_authored', count: Number(definitionRows[0]?.n ?? 0) },
    { key: 'hr_employee_profile', count: Number(profileRows[0]?.n ?? 0) },
    { key: 'login_account', count: Number(accountRows[0]?.n ?? 0) },
  ];
  return dependencies.filter(dep => dep.count > 0);
}

async function classAssignmentsForTeacher(tenantId: string, teacherId: string): Promise<TeacherClassAssignmentHistoryItem[]> {
  const today = todayIso();
  const rows = await db
    .select({
      id: classTeachers.id,
      classSectionId: classTeachers.classSectionId,
      role: classTeachers.role,
      status: classTeachers.status,
      startsOn: classTeachers.startsOn,
      endsOn: classTeachers.endsOn,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(classTeachers)
    .innerJoin(classSections, eq(classTeachers.classSectionId, classSections.id))
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .where(and(eq(classTeachers.tenantId, tenantId), eq(classTeachers.teacherId, teacherId)))
    .orderBy(desc(classTeachers.startsOn));

  const studentCounts = new Map<string, number>();
  const currentSectionIds = rows
    .filter(row => row.status === 'active' && (!row.endsOn || row.endsOn >= today))
    .map(row => row.classSectionId);
  if (currentSectionIds.length > 0) {
    const countRows = await db
      .select({ classSectionId: user.classSectionId, n: count() })
      .from(user)
      .where(and(
        eq(user.role, 'student'),
        eq(user.tenantId, tenantId),
        inArray(user.classSectionId, currentSectionIds),
      ))
      .groupBy(user.classSectionId);
    for (const row of countRows) {
      if (row.classSectionId) {
        studentCounts.set(row.classSectionId, Number(row.n ?? 0));
      }
    }
  }

  return rows.map(row => ({
    id: row.id,
    classSectionId: row.classSectionId,
    label: `${row.className} ${row.sectionName}`.trim(),
    role: row.role,
    status: row.status,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    isCurrent: row.status === 'active' && (!row.endsOn || row.endsOn >= today),
    studentCount: studentCounts.get(row.classSectionId) ?? 0,
  }));
}

async function subjectAssignmentsForTeacher(tenantId: string, teacherId: string): Promise<TeacherSubjectAssignmentItem[]> {
  const rows = await db
    .select({
      id: subjectTeachers.id,
      subjectId: subjectTeachers.subjectId,
      subjectName: subjects.name,
      classSectionId: subjectTeachers.classSectionId,
      offeringId: subjectTeachers.offeringId,
      className: classes.name,
      sectionName: sections.name,
      isActive: classSubjects.isActive,
    })
    .from(subjectTeachers)
    .innerJoin(subjects, eq(subjectTeachers.subjectId, subjects.id))
    .innerJoin(classSections, eq(subjectTeachers.classSectionId, classSections.id))
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .innerJoin(classSubjects, eq(subjectTeachers.classSubjectId, classSubjects.id))
    .where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.teacherId, teacherId)))
    .orderBy(asc(subjects.name));

  return rows.map(row => ({
    id: row.id,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    classSectionId: row.classSectionId,
    classLabel: `${row.className} ${row.sectionName}`.trim(),
    offeringId: row.offeringId,
    isCurrent: row.isActive,
  }));
}

export async function getTeacherDetail(
  viewer: RequestContext,
  tenantId: string,
  id: string,
  effectiveBranchId?: string | null,
): Promise<TeacherDetail | null> {
  const row = await findScopedTeacher(viewer, tenantId, id, effectiveBranchId);
  if (!row) {
    return null;
  }

  const sensitive = await hasCapability(viewer.userId, tenantId, viewer.role, 'hr.sensitive.read');

  const [items, classAssignments, subjectAssignments, profileRows, dependencies] = await Promise.all([
    hydrateDirectoryItems(tenantId, [row]),
    classAssignmentsForTeacher(tenantId, id),
    subjectAssignmentsForTeacher(tenantId, id),
    db
      .select({
        contractType: employeeProfiles.contractType,
        employmentType: employeeProfiles.employmentType,
        employmentStatus: employeeProfiles.employmentStatus,
        contractStartDate: employeeProfiles.contractStartDate,
        contractEndDate: employeeProfiles.contractEndDate,
        hireDate: employeeProfiles.hireDate,
        salary: employeeProfiles.salary,
        bankRib: employeeProfiles.bankRib,
        cnssNumber: employeeProfiles.cnssNumber,
        amoNumber: employeeProfiles.amoNumber,
        nationalId: employeeProfiles.nationalId,
      })
      .from(employeeProfiles)
      .where(and(eq(employeeProfiles.userId, id), eq(employeeProfiles.tenantId, tenantId)))
      .limit(1),
    teacherDependencyCounts(tenantId, id),
  ]);

  const base = items[0]!;
  const profile = profileRows[0] ?? null;
  const documents = asDocumentFlags(row.documents);

  const employment: TeacherEmploymentSummary | null = profile
    ? {
        contractType: profile.contractType,
        employmentType: profile.employmentType,
        employmentStatus: profile.employmentStatus,
        contractStartDate: profile.contractStartDate,
        contractEndDate: profile.contractEndDate,
        hireDate: profile.hireDate,
      }
    : null;

  const sensitiveHr: TeacherSensitiveHr | null = sensitive
    ? {
        salary: profile?.salary ?? row.salary ?? null,
        nationalId: profile?.nationalId ?? row.nationalId ?? null,
        address: row.address ?? null,
        city: row.city ?? null,
        dateOfBirth: row.dateOfBirth ?? null,
        bankRib: profile?.bankRib ?? null,
        cnssNumber: profile?.cnssNumber ?? null,
        amoNumber: profile?.amoNumber ?? null,
      }
    : null;

  return {
    ...base,
    firstName: row.firstName,
    lastName: row.lastName,
    cycle: row.cycle ?? '',
    qualification: row.qualification ?? null,
    hireDate: row.hireDate ?? null,
    createdAt: row.createdAt,
    lastLogin: row.lastLogin ?? null,
    documents: {
      contract: documents.contract === true,
      cin: documents.cin === true,
      diploma: documents.diploma === true,
    },
    employment,
    sensitiveHr,
    sensitiveRedacted: !sensitive,
    classAssignments,
    subjectAssignments,
    canHardDelete: dependencies.length === 0,
    dependencies,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export type CreateTeacherInput = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  employeeId?: string | null;
  specialization?: string | null;
  cycle?: string | null;
  hireDate?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationalId?: string | null;
  address?: string | null;
  city?: string | null;
  qualification?: string | null;
  salary?: number | null;
  status?: string | null;
  branchId?: string | null;
  documents?: { contract?: boolean; cin?: boolean; diploma?: boolean };
};

export type TeacherProvisioningResult = {
  tokenCreated: boolean;
  deliveryStatus: 'queued' | 'no_phone';
  /** Raw activation token — returned once so the admin can copy the link. */
  setupUrl: string | null;
};

async function verifyBranchBelongsToTenant(tenantId: string, branchId: string): Promise<void> {
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
    .limit(1);
  if (!branch) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'Le campus indiqué n\'existe pas pour cet établissement.');
  }
}

async function assertEmailAvailable(tenantId: string, email: string, excludeUserId?: string): Promise<void> {
  const [existing] = await db
    .select({ id: user.id, tenantId: user.tenantId })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!existing || existing.id === excludeUserId) {
    return;
  }
  if (existing.tenantId === tenantId) {
    throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Un compte utilise déjà cette adresse email dans cet établissement.');
  }
  // user_email_unique is global in the current schema; a cross-tenant address
  // cannot be reused without changing that constraint (deferred migration).
  throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Cette adresse email est déjà utilisée sur la plateforme.');
}

/** Reserve the next tenant-scoped EMP- sequence id, skipping global collisions. */
export async function reserveTeacherEmployeeId(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = await reserveEmployeeId(tenantId);
    const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.employeeId, candidate)).limit(1);
    if (!taken) {
      return candidate;
    }
  }
  throw new ApiError(500, 'EMPLOYEE_ID_EXHAUSTED', 'Impossible de générer un identifiant employé unique.');
}

/**
 * Link an existing (unlinked) HR employee profile rather than creating a
 * second identity. Employee creation itself stays owned by the HR module.
 */
async function linkExistingEmployeeProfile(tenantId: string, teacherId: string, email: string, fullName: string) {
  const [candidate] = await db
    .select({ id: employeeProfiles.id, employeeId: employeeProfiles.employeeId, userId: employeeProfiles.userId })
    .from(employeeProfiles)
    .where(and(
      eq(employeeProfiles.tenantId, tenantId),
      isNull(employeeProfiles.userId),
      or(
        eq(employeeProfiles.email, email),
        eq(employeeProfiles.firstName, fullName.split(' ')[0] ?? ''),
      ),
    ))
    .limit(1);

  if (!candidate) {
    return null;
  }
  await db
    .update(employeeProfiles)
    .set({ userId: teacherId, updatedAt: new Date().toISOString() })
    .where(and(eq(employeeProfiles.id, candidate.id), eq(employeeProfiles.tenantId, tenantId)));
  return candidate;
}

async function provisionTeacherAccount(
  tenantId: string,
  actorId: string,
  teacherId: string,
  phone: string | null,
): Promise<TeacherProvisioningResult> {
  if (!phone) {
    return { tokenCreated: false, deliveryStatus: 'no_phone', setupUrl: null };
  }
  const token = generateSetupToken();
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS).toISOString();
  await db.insert(accountSetupTokens).values({
    tenantId,
    userId: teacherId,
    token: hashSetupToken(token),
    expiresAt,
  });
  await db.insert(smsMessages).values({
    tenantId,
    recipientPhone: normalizeMoroccanPhone(phone) || phone,
    body: `SchoolOS : activez votre compte enseignant via ce lien : /setup-account?token=${token}`,
    status: 'queued',
    createdById: actorId,
  });
  return { tokenCreated: true, deliveryStatus: 'queued', setupUrl: `/setup-account?token=${token}` };
}

export type CreatedTeacherRecord = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  provisioning: TeacherProvisioningResult;
  linkedEmployeeProfileId: string | null;
};

/**
 * Insert the teacher user row (branch, employee id, provisioning, HR link)
 * without hydrating the directory projection. Used by the single-create flow
 * and by bulk import, where hydrating every row would be wasted work.
 */
export async function insertTeacherRecord(
  viewer: RequestContext,
  tenantId: string,
  input: CreateTeacherInput,
): Promise<CreatedTeacherRecord> {
  const id = `TCH-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = (input.email || `${id.toLowerCase()}@schoolos.ma`).toLowerCase().trim();

  // Branch: a branch-limited principal pins the teacher to their own branch;
  // a whole-school principal may pick one (validated) or leave it unassigned.
  let branchId: string | null = viewer.branchId ?? null;
  if (input.branchId) {
    await verifyBranchBelongsToTenant(tenantId, input.branchId);
    if (viewer.branchId && input.branchId !== viewer.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez créer un enseignant que sur votre campus.');
    }
    branchId = input.branchId;
  }

  await assertEmailAvailable(tenantId, email);

  let employeeId = input.employeeId?.trim() || null;
  if (employeeId) {
    const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.employeeId, employeeId)).limit(1);
    if (taken) {
      throw new ApiError(409, 'EMPLOYEE_ID_ALREADY_EXISTS', 'Cet identifiant employé est déjà utilisé sur la plateforme.');
    }
  } else {
    employeeId = await reserveTeacherEmployeeId(tenantId);
  }

  const [inserted] = await db
    .insert(user)
    .values({
      id,
      tenantId,
      branchId,
      name: input.fullName.trim(),
      email,
      phone: input.phone?.trim() || null,
      role: 'teacher',
      employeeId,
      specialization: input.specialization?.trim() || null,
      cycle: input.cycle?.trim() || null,
      hireDate: input.hireDate || null,
      dateOfBirth: input.dateOfBirth || null,
      gender: (input.gender as 'female' | 'male' | 'other' | undefined) || null,
      nationalId: input.nationalId?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      qualification: input.qualification?.trim() || null,
      salary: input.salary != null ? String(input.salary) : null,
      userStatus: toDbStatus(input.status, 'active'),
      documents: input.documents ?? undefined,
    })
    .returning();

  const linked = await linkExistingEmployeeProfile(tenantId, inserted!.id, email, input.fullName);
  const provisioning = await provisionTeacherAccount(tenantId, viewer.userId, inserted!.id, inserted!.phone ?? null);

  return {
    id: inserted!.id,
    employeeId: inserted!.employeeId ?? '',
    name: inserted!.name,
    email: inserted!.email,
    provisioning,
    linkedEmployeeProfileId: linked?.id ?? null,
  };
}

export async function createTeacher(
  viewer: RequestContext,
  tenantId: string,
  input: CreateTeacherInput,
): Promise<{ teacher: TeacherDirectoryItem; provisioning: TeacherProvisioningResult; linkedEmployeeProfileId: string | null }> {
  const record = await insertTeacherRecord(viewer, tenantId, input);
  const [row] = await db.select().from(user).where(and(eq(user.id, record.id), eq(user.tenantId, tenantId))).limit(1);
  const [item] = await hydrateDirectoryItems(tenantId, [row!]);
  return { teacher: item!, provisioning: record.provisioning, linkedEmployeeProfileId: record.linkedEmployeeProfileId };
}

/**
 * Current academic dependencies that make a direct campus reassignment unsafe.
 * Only ACTIVE, non-ended class-teacher rows block; subject_teachers and
 * timetable rows have no history columns today, so any row counts as current.
 * Historical rows are never touched by this check — they are why reassignment
 * needs a real transfer workflow instead of a silent branch flip.
 */
export async function currentAssignmentBlockers(tenantId: string, teacherId: string): Promise<TeacherDependency[]> {
  const today = todayIso();
  const [classRows, subjectRows, scheduleRows, legacyScheduleRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(classTeachers)
      .where(and(
        eq(classTeachers.tenantId, tenantId),
        eq(classTeachers.teacherId, teacherId),
        eq(classTeachers.status, 'active'),
        or(isNull(classTeachers.endsOn), gte(classTeachers.endsOn, today))!,
      )),
    db.select({ n: count() }).from(subjectTeachers).where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.teacherId, teacherId))),
    db.select({ n: count() }).from(classScheduleSlots).where(and(eq(classScheduleSlots.tenantId, tenantId), eq(classScheduleSlots.teacherId, teacherId))),
    db.select({ n: count() }).from(timetableSlots).where(and(eq(timetableSlots.tenantId, tenantId), eq(timetableSlots.teacherId, teacherId))),
  ]);

  return [
    { key: 'class_assignments_active', count: Number(classRows[0]?.n ?? 0) },
    { key: 'subject_assignments', count: Number(subjectRows[0]?.n ?? 0) },
    { key: 'timetable_slots', count: Number(scheduleRows[0]?.n ?? 0) },
    { key: 'legacy_timetable_slots', count: Number(legacyScheduleRows[0]?.n ?? 0) },
  ].filter(dep => dep.count > 0);
}

export type UpdateTeacherInput = {
  name?: string;
  phone?: string | null;
  specialization?: string | null;
  cycle?: string | null;
  hireDate?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationalId?: string | null;
  address?: string | null;
  city?: string | null;
  qualification?: string | null;
  salary?: number | null;
  documents?: { contract?: boolean; cin?: boolean; diploma?: boolean };
  branchId?: string | null;
};

export async function updateTeacher(
  viewer: RequestContext,
  tenantId: string,
  id: string,
  input: UpdateTeacherInput,
): Promise<TeacherDirectoryItem> {
  const existing = await findScopedTeacher(viewer, tenantId, id);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Enseignant introuvable.');
  }

  let branchId: string | undefined;
  if (input.branchId !== undefined && input.branchId !== null) {
    await verifyBranchBelongsToTenant(tenantId, input.branchId);
    if (viewer.branchId && input.branchId !== viewer.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez pas déplacer un enseignant vers un autre campus.');
    }
    branchId = input.branchId;

    // Direct campus reassignment is refused while the teacher still has
    // current academic dependencies: moving only user.branchId would leave
    // class/subject/timetable assignments pointing at the old campus. Until a
    // full transfer workflow exists, the assignments must be closed first.
    if (branchId !== existing.branchId) {
      const blockers = await currentAssignmentBlockers(tenantId, id);
      if (blockers.length > 0) {
        throw new ApiError(
          409,
          'TEACHER_BRANCH_TRANSFER_REQUIRED',
          'Cet enseignant possède encore des affectations actives dans son campus actuel. Clôturez ou transférez ses affectations avant de changer de campus.',
        );
      }
    }
  }

  const [updated] = await db
    .update(user)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.specialization !== undefined ? { specialization: input.specialization?.trim() || null } : {}),
      ...(input.cycle !== undefined ? { cycle: input.cycle?.trim() || null } : {}),
      ...(input.hireDate !== undefined ? { hireDate: input.hireDate || null } : {}),
      ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth || null } : {}),
      ...(input.gender !== undefined ? { gender: (input.gender as 'female' | 'male' | 'other' | undefined) || null } : {}),
      ...(input.nationalId !== undefined ? { nationalId: input.nationalId?.trim() || null } : {}),
      ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
      ...(input.city !== undefined ? { city: input.city?.trim() || null } : {}),
      ...(input.qualification !== undefined ? { qualification: input.qualification?.trim() || null } : {}),
      ...(input.salary !== undefined ? { salary: input.salary === null ? null : String(input.salary) } : {}),
      ...(input.documents !== undefined ? { documents: input.documents } : {}),
      ...(branchId !== undefined ? { branchId } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(user.id, id), eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
    .returning();

  if (!updated) {
    throw new ApiError(404, 'NOT_FOUND', 'Enseignant introuvable.');
  }

  const [item] = await hydrateDirectoryItems(tenantId, [updated]);
  return item!;
}

export type TeacherLifecycleResult = {
  teacher: TeacherDirectoryItem;
  closedClassAssignments: number;
  statusChanged: boolean;
};

/**
 * Status transition. active <-> inactive <-> archived.
 *
 * Deactivating or archiving closes current class-teacher assignments (they
 * carry endsOn/status history, so closing them is non-destructive) and leaves
 * every historical record in place. subject_teachers has no history columns in
 * the current schema, so those rows are deliberately NOT deleted — deleting
 * them would destroy the only record of who taught what. That schema gap is
 * documented as a deferred migration.
 */
export async function transitionTeacherStatus(
  viewer: RequestContext,
  tenantId: string,
  id: string,
  status: TeacherStatus,
  _reason?: string | null,
): Promise<TeacherLifecycleResult> {
  if (!['active', 'inactive', 'archived'].includes(status)) {
    throw new ApiError(422, 'INVALID_STATUS', 'Statut enseignant invalide (active, inactive, archived).');
  }
  const existing = await findScopedTeacher(viewer, tenantId, id);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Enseignant introuvable.');
  }

  const statusChanged = existing.userStatus !== status;
  if (statusChanged) {
    await db
      .update(user)
      .set({ userStatus: status, updatedAt: new Date().toISOString() })
      .where(and(eq(user.id, id), eq(user.tenantId, tenantId), eq(user.role, 'teacher')));
  }

  let closedClassAssignments = 0;
  if (status !== 'active') {
    const today = todayIso();
    const closed = await db
      .update(classTeachers)
      .set({ endsOn: today, status: 'inactive' })
      .where(and(
        eq(classTeachers.tenantId, tenantId),
        eq(classTeachers.teacherId, id),
        eq(classTeachers.status, 'active'),
        isNull(classTeachers.endsOn),
      ))
      .returning({ id: classTeachers.id });
    closedClassAssignments = closed.length;
  }

  const [fresh] = await db.select().from(user).where(and(eq(user.id, id), eq(user.tenantId, tenantId))).limit(1);
  const [item] = await hydrateDirectoryItems(tenantId, [fresh!]);
  return { teacher: item!, closedClassAssignments, statusChanged };
}

export type HardDeleteCheck = {
  canHardDelete: boolean;
  dependencies: TeacherDependency[];
};

export async function checkHardDelete(viewer: RequestContext, tenantId: string, id: string): Promise<HardDeleteCheck> {
  const existing = await findScopedTeacher(viewer, tenantId, id);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Enseignant introuvable.');
  }
  const dependencies = await teacherDependencyCounts(tenantId, id);
  return { canHardDelete: dependencies.length === 0, dependencies };
}

/** Hard delete only for a clean record with zero academic/HR dependencies. */
export async function hardDeleteTeacher(viewer: RequestContext, tenantId: string, id: string): Promise<void> {
  const existing = await findScopedTeacher(viewer, tenantId, id);
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Enseignant introuvable.');
  }
  const dependencies = await teacherDependencyCounts(tenantId, id);
  if (dependencies.length > 0) {
    throw new ApiError(
      409,
      'CANNOT_HARD_DELETE',
      'Cet enseignant possède un historique académique ou RH : désactivez-le ou archivez-le au lieu de le supprimer.',
    );
  }
  try {
    await db.delete(user).where(and(eq(user.id, id), eq(user.tenantId, tenantId), eq(user.role, 'teacher')));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === '23503') {
      throw new ApiError(409, 'CANNOT_HARD_DELETE', 'Cet enseignant est référencé par un autre enregistrement et ne peut pas être supprimé.');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

export type TeacherFilterOptions = {
  subjects: { id: string; name: string }[];
  classes: { id: string; label: string }[];
  branches: { id: string; name: string }[];
  scope: TeacherScopeInfo;
};

/**
 * Filter options for the directory.
 *
 * Subjects/classes are limited to teachers in the selected scope. Branches are
 * the selectable scopes themselves: a whole-school principal may pick any
 * active branch of the tenant (so the selector can name every campus even
 * before it has teachers), a branch-limited principal only ever sees their own.
 */
export async function listTeacherFilterOptions(
  viewer: RequestContext,
  tenantId: string,
  requestedBranchId?: string | null,
): Promise<TeacherFilterOptions> {
  const scope = await resolveTeacherScope(viewer, tenantId, requestedBranchId);
  const scopedIds = scopedTeacherIdsSubquery(tenantId, scope.effectiveBranchId);

  const [subjectRows, classRows, branchRows] = await Promise.all([
    db
      .selectDistinct({ id: subjects.id, name: subjects.name })
      .from(subjectTeachers)
      .innerJoin(subjects, eq(subjectTeachers.subjectId, subjects.id))
      .where(and(eq(subjectTeachers.tenantId, tenantId), inArray(subjectTeachers.teacherId, scopedIds)))
      .orderBy(asc(subjects.name)),
    db
      .selectDistinct({
        id: classSections.id,
        className: classes.name,
        sectionName: sections.name,
      })
      .from(classTeachers)
      .innerJoin(classSections, eq(classTeachers.classSectionId, classSections.id))
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(eq(classTeachers.tenantId, tenantId), inArray(classTeachers.teacherId, scopedIds)))
      .orderBy(asc(classes.name), asc(sections.name)),
    viewer.branchId
      ? db
          .selectDistinct({ id: branches.id, name: branches.name })
          .from(branches)
          .where(and(
            eq(branches.tenantId, tenantId),
            eq(branches.id, viewer.branchId),
            eq(branches.isActive, true),
          ))
      : db
          .selectDistinct({ id: branches.id, name: branches.name })
          .from(branches)
          .where(and(eq(branches.tenantId, tenantId), eq(branches.isActive, true)))
          .orderBy(asc(branches.name)),
  ]);

  return {
    subjects: subjectRows.map(row => ({ id: row.id, name: row.name })),
    classes: classRows.map(row => ({ id: row.id, label: `${row.className} ${row.sectionName}`.trim() })),
    branches: branchRows.map(row => ({ id: row.id, name: row.name })),
    scope,
  };
}

// ---------------------------------------------------------------------------
// Export rows
// ---------------------------------------------------------------------------

export type TeacherExportScope = Pick<TeacherListFilters, 'search' | 'status' | 'subjectId' | 'classSectionId' | 'branchId'>;

/**
 * Same filters as the directory, but the whole authorized result set (bounded)
 * with the safe projection only — no salary, RIB, CNSS, national id or DOB.
 */
export async function listTeachersForExport(
  viewer: RequestContext,
  tenantId: string,
  filters: TeacherExportScope,
): Promise<{ items: TeacherDirectoryItem[]; scope: TeacherScopeInfo }> {
  // Same scope resolution as the list: export can never widen what the
  // directory shows.
  const scope = await resolveTeacherScope(viewer, tenantId, filters.branchId);
  const conditions = buildListConditions(tenantId, scope.effectiveBranchId, { ...filters, page: 1, pageSize: 100 });
  const rows = await db
    .select()
    .from(user)
    .where(and(...conditions))
    .orderBy(asc(user.name), asc(user.id))
    .limit(5000);
  return { items: await hydrateDirectoryItems(tenantId, rows), scope };
}
