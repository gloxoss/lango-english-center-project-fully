import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { attendance, classes, classSections, sections, sessionYears, user } from '@/models/Schema';
import { ReportNotReadyError } from '../services/report-not-ready-error';

// CANONICAL SESSION SCOPE (Phase 7B): every attendance report aggregates the
// same eligible-mark truth as attendanceSummary — current session (date-active,
// else the tenant default), non-voided marks only, and approved excuses
// reconciled at their exact scope (period/section when the excuse carries one).
async function resolveCurrentSessionYearId(tenantId: string): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const [active] = await db
    .select({ id: sessionYears.id })
    .from(sessionYears)
    .where(and(
      eq(sessionYears.tenantId, tenantId),
      sql`${sessionYears.startDate}::date <= ${today}::date`,
      sql`${sessionYears.endDate}::date >= ${today}::date`,
    ))
    .orderBy(desc(sessionYears.startDate))
    .limit(1);
  if (active?.id) {
    return active.id;
  }
  const [fallback] = await db
    .select({ id: sessionYears.id })
    .from(sessionYears)
    .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
    .limit(1);
  return fallback?.id ?? null;
}

export class AttendanceAdapter {
  /**
   * 1. Student Attendance Log Report.
   */
  static async getStudentAttendanceLogReport(tenantId: string, params?: any) {
    const sessionYearId = await resolveCurrentSessionYearId(tenantId);
    const conditions = [
      eq(attendance.tenantId, tenantId),
      eq(attendance.isVoided, false),
    ];
    if (sessionYearId) {
      conditions.push(eq(attendance.academicYearId, sessionYearId));
    }
    if (params?.studentId) {
      conditions.push(eq(attendance.studentId, String(params.studentId)));
    }

    const records = await db
      .select({
        studentId: attendance.studentId,
        studentName: user.name,
        date: attendance.date,
        sessionName: sql<string>`'Période ' || ${attendance.period}`,
        status: attendance.status,
        lateMinutes: attendance.lateMinutes,
        isExcused: sql<boolean>`(${attendance.status} = 'excused' OR EXISTS (
          SELECT 1 FROM attendance_excuses ex
          WHERE ex.tenant_id = ${attendance.tenantId}
            AND ex.student_id = ${attendance.studentId}
            AND ex.date = ${attendance.date}
            AND ex.status = 'approved'
            AND (ex.class_section_id IS NULL OR ex.class_section_id = ${attendance.classSectionId})
            AND (ex.period IS NULL OR ex.period = ${attendance.period})
        ))`,
      })
      .from(attendance)
      .innerJoin(user, and(eq(attendance.studentId, user.id), eq(user.tenantId, tenantId)))
      .where(and(...conditions))
      .orderBy(desc(attendance.date), desc(attendance.period))
      .limit(1000);

    return records;
  }

  /**
   * 2. Daily Section Matrix Report.
   */
  static async getDailySectionMatrixReport(tenantId: string, params?: any) {
    const date = typeof params?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : new Date().toISOString().slice(0, 10);

    const list = await db
      .select({
        className: classes.name,
        sectionName: sections.name,
        presentCount: sql<number>`sum(case when ${attendance.status} = 'present' then 1 else 0 end)::int`,
        absentCount: sql<number>`sum(case when ${attendance.status} = 'absent' then 1 else 0 end)::int`,
        lateCount: sql<number>`sum(case when ${attendance.status} = 'late' then 1 else 0 end)::int`,
        excusedCount: sql<number>`sum(case when ${attendance.status} = 'excused' then 1 else 0 end)::int`,
        registerStatus: sql<string | null>`(
          SELECT CASE
            WHEN bool_or(r.status = 'LOCKED') THEN 'LOCKED'
            WHEN count(*) > 0 THEN 'REOPENED'
            ELSE NULL
          END
          FROM attendance_registers r
          WHERE r.tenant_id = ${attendance.tenantId}
            AND r.class_section_id = ${attendance.classSectionId}
            AND r.date = ${date}::date
        )`,
      })
      .from(attendance)
      .innerJoin(classSections, and(eq(attendance.classSectionId, classSections.id), eq(classSections.tenantId, tenantId)))
      .innerJoin(classes, and(eq(classSections.classId, classes.id), eq(classes.tenantId, tenantId)))
      .innerJoin(sections, and(eq(classSections.sectionId, sections.id), eq(sections.tenantId, tenantId)))
      .where(and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.isVoided, false),
        eq(attendance.date, date),
      ))
      .groupBy(classes.name, sections.name)
      .orderBy(classes.name, sections.name);

    return list.map(item => ({
      className: item.className,
      sectionName: item.sectionName,
      presentCount: Number(item.presentCount || 0),
      absentCount: Number(item.absentCount || 0),
      lateCount: Number(item.lateCount || 0),
      excusedCount: Number(item.excusedCount || 0),
      registerStatus: item.registerStatus || 'OPEN',
    }));
  }

  /**
   * 3. Attendance Overview & Risk Streaks Report.
   */
  static async getAttendanceOverviewReport(tenantId: string, _params?: any) {
    const sessionYearId = await resolveCurrentSessionYearId(tenantId);

    const overview = await db
      .select({
        studentName: user.name,
        totalSessions: sql<number>`count(${attendance.id})::int`,
        attendedSessions: sql<number>`coalesce(sum(case when ${attendance.status} in ('present', 'late') then 1 else 0 end), 0)::int`,
        unexcusedAbsences: sql<number>`coalesce(sum(case when ${attendance.status} = 'absent' and not exists (
          SELECT 1 FROM attendance_excuses ex
          WHERE ex.tenant_id = ${tenantId}::uuid
            AND ex.student_id = ${attendance.studentId}
            AND ex.date = ${attendance.date}
            AND ex.status = 'approved'
            AND (ex.class_section_id IS NULL OR ex.class_section_id = ${attendance.classSectionId})
            AND (ex.period IS NULL OR ex.period = ${attendance.period})
        ) then 1 else 0 end), 0)::int`,
      })
      .from(user)
      .leftJoin(attendance, and(
        eq(attendance.studentId, user.id),
        eq(attendance.tenantId, tenantId),
        eq(attendance.isVoided, false),
        ...(sessionYearId ? [eq(attendance.academicYearId, sessionYearId)] : []),
      ))
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .groupBy(user.id, user.name)
      .orderBy(user.name);

    return overview.map((o) => {
      const total = Number(o.totalSessions || 0);
      const attended = Number(o.attendedSessions || 0);
      const unexcused = Number(o.unexcusedAbsences || 0);
      // PHYSICAL PRESENCE: attended = present + late (see attendedSessions). A
      // zero denominator is "not calculated" (null), never a fabricated 100.
      const rate = total > 0 ? Math.round((attended / total) * 100) : null;
      let alert = total > 0 ? 'Normal' : 'À configurer';
      if (unexcused >= 5) {
        alert = 'Critique';
      } else if (unexcused >= 3) {
        alert = 'Élevé';
      }

      return {
        studentName: o.studentName,
        totalSessions: total,
        attendanceRate: rate,
        unexcusedAbsences: unexcused,
        riskAlertLevel: alert,
      };
    });
  }

  /**
   * 4. Employee Attendance Summary Report.
   * No staff/employee attendance table exists anywhere in this schema - the
   * `attendance` table is hard-scoped to studentId (not null). Honestly
   * not-ready rather than fabricating worked-days/hours/lateness figures.
   * See future-implementation/advanced-reporting remediation, section-03.
   */
  static async getEmployeeAttendanceSummaryReport(_tenantId: string, _params?: any): Promise<never> {
    throw new ReportNotReadyError('Le pointage du personnel n\'a pas encore de modèle de données réel dans ce système.');
  }

  /**
   * 5. Exam Session Attendance Report.
   * exam_seats (seat assignment) exists but has no check-in/incident columns
   * - it is a seating chart, not an attendance record, and cannot honestly
   * populate the checkInStatus/incidentNote columns this report promises.
   * See future-implementation/advanced-reporting remediation, section-03.
   */
  static async getExamSessionAttendanceReport(_tenantId: string, _params?: any): Promise<never> {
    throw new ReportNotReadyError('L\'émargement des séances d\'examen n\'a pas encore de suivi de présence réel dans ce système.');
  }
}
