import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { attendance, attendanceRegisters, classSections, classes, sections, user } from '@/models/Schema';
import { ReportNotReadyError } from '../services/report-not-ready-error';

export class AttendanceAdapter {
  /**
   * 1. Student Attendance Log Report.
   */
  static async getStudentAttendanceLogReport(tenantId: string, params?: any) {
    const records = await db
      .select({
        studentId: attendance.studentId,
        studentName: user.name,
        date: attendance.date,
        sessionName: sql<string>`'Séance Régulière'`,
        status: attendance.status,
        lateMinutes: attendance.lateMinutes,
        isExcused: sql<boolean>`CASE WHEN ${attendance.status} = 'excused' THEN true ELSE false END`,
      })
      .from(attendance)
      .innerJoin(user, eq(attendance.studentId, user.id))
      .where(eq(user.tenantId, tenantId))
      .limit(100);

    return records;
  }

  /**
   * 2. Daily Section Matrix Report.
   */
  static async getDailySectionMatrixReport(tenantId: string, params?: any) {
    const list = await db
      .select({
        className: classes.name,
        sectionName: sections.name,
        presentCount: sql<number>`SUM(CASE WHEN ${attendance.status} = 'present' THEN 1 ELSE 0 END)`,
        absentCount: sql<number>`SUM(CASE WHEN ${attendance.status} = 'absent' THEN 1 ELSE 0 END)`,
        lateCount: sql<number>`SUM(CASE WHEN ${attendance.status} = 'late' THEN 1 ELSE 0 END)`,
        registerStatus: attendanceRegisters.status,
      })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .leftJoin(attendanceRegisters, eq(attendanceRegisters.classId, classes.id))
      .leftJoin(attendance, eq(attendance.registerId, attendanceRegisters.id))
      .where(eq(classes.tenantId, tenantId))
      .groupBy(classes.name, sections.name, attendanceRegisters.status);

    return list.map(item => ({
      className: item.className,
      sectionName: item.sectionName,
      presentCount: Number(item.presentCount || 0),
      absentCount: Number(item.absentCount || 0),
      lateCount: Number(item.lateCount || 0),
      registerStatus: item.registerStatus || 'OPEN',
    }));
  }

  /**
   * 3. Attendance Overview & Risk Streaks Report.
   */
  static async getAttendanceOverviewReport(tenantId: string, params?: any) {
    const overview = await db
      .select({
        studentName: user.name,
        totalSessions: count(attendance.id),
        presentSessions: sql<number>`SUM(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 ELSE 0 END)`,
        unexcusedAbsences: sql<number>`SUM(CASE WHEN ${attendance.status} = 'absent' THEN 1 ELSE 0 END)`,
      })
      .from(user)
      .leftJoin(attendance, eq(attendance.studentId, user.id))
      .where(sql`${user.tenantId} = ${tenantId} AND ${user.role} = 'student'`)
      .groupBy(user.id, user.name);

    return overview.map(o => {
      const total = Number(o.totalSessions || 0);
      const present = Number(o.presentSessions || 0);
      const unexcused = Number(o.unexcusedAbsences || 0);
      const rate = total > 0 ? Math.round((present / total) * 100) : 100;
      let alert = 'Normal';
      if (unexcused >= 5) alert = 'Critique';
      else if (unexcused >= 3) alert = 'Élevé';

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
  static async getEmployeeAttendanceSummaryReport(tenantId: string, params?: any): Promise<never> {
    throw new ReportNotReadyError('Le pointage du personnel n\'a pas encore de modèle de données réel dans ce système.');
  }

  /**
   * 5. Exam Session Attendance Report.
   * exam_seats (seat assignment) exists but has no check-in/incident columns
   * - it is a seating chart, not an attendance record, and cannot honestly
   * populate the checkInStatus/incidentNote columns this report promises.
   * See future-implementation/advanced-reporting remediation, section-03.
   */
  static async getExamSessionAttendanceReport(tenantId: string, params?: any): Promise<never> {
    throw new ReportNotReadyError('L\'émargement des séances d\'examen n\'a pas encore de suivi de présence réel dans ce système.');
  }
}
