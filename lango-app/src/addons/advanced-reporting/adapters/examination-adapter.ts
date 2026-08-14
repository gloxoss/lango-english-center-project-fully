import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { semesters, user } from '@/models/Schema';
import { assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { SnapshotService } from '../services/snapshot-service';
import { ReportNotReadyError } from '../services/report-not-ready-error';

export class ExaminationAdapter {
  /**
   * 1. Official Report Card Snapshot Report.
   */
  static async getReportCardSnapshotReport(tenantId: string, params?: any) {
    const periodKey = params?.periodKey || '2026-T1';
    const snapshot = await SnapshotService.getSnapshot(tenantId, 'exam.report_card', periodKey);

    if (snapshot && snapshot.snapshotData && Array.isArray((snapshot.snapshotData as any).rows)) {
      return (snapshot.snapshotData as any).rows;
    }

    throw new ReportNotReadyError('Aucun bulletin officiel (snapshot) n\'a encore été généré pour cette période.');
  }

  /**
   * 2. Class Tabulation Sheet Report. Real aggregation from assessmentOutcomes
   * (the shared, genuinely-graded ledger), summed per student.
   */
  static async getTabulationSheetReport(tenantId: string, params?: any) {
    const rows = await db
      .select({
        studentId: assessmentOutcomes.studentId,
        studentName: user.name,
        rawScore: assessmentOutcomes.rawScore,
        maximumScoreSnapshot: assessmentOutcomes.maximumScoreSnapshot,
      })
      .from(assessmentOutcomes)
      .innerJoin(assessmentDefinitions, eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitions.id))
      .innerJoin(user, eq(assessmentOutcomes.studentId, user.id))
      .where(and(
        eq(assessmentOutcomes.tenantId, tenantId),
        eq(assessmentOutcomes.status, 'graded'),
        params?.classId ? eq(assessmentDefinitions.classSubjectId, params.classId) : undefined,
      ));

    const byStudent = new Map<string, { studentName: string; total: number; max: number }>();
    for (const r of rows) {
      const entry = byStudent.get(r.studentId) ?? { studentName: r.studentName, total: 0, max: 0 };
      entry.total += Number(r.rawScore ?? 0);
      entry.max += Number(r.maximumScoreSnapshot);
      byStudent.set(r.studentId, entry);
    }

    const ranked = Array.from(byStudent.values())
      .map(s => ({ studentName: s.studentName, totalMarks: s.total, overallAverage: s.max > 0 ? Number(((s.total / s.max) * 20).toFixed(2)) : 0 }))
      .sort((a, b) => b.totalMarks - a.totalMarks);

    return ranked.map((s, i) => ({
      studentName: s.studentName,
      totalMarks: s.totalMarks,
      overallAverage: s.overallAverage,
      rank: i + 1,
      decision: s.overallAverage >= 16 ? 'Admis(e) avec Félicitations' : s.overallAverage >= 14 ? 'Admis(e) avec Encouragements' : s.overallAverage >= 10 ? 'Admis(e)' : 'Ajourné(e)',
    }));
  }

  /**
   * 3. Subject Progress & Competency Report. Real per-term average from
   * assessmentOutcomes for a single student.
   */
  static async getProgressReport(tenantId: string, params?: any) {
    if (!params?.studentId) {
      throw new Error('Le paramètre studentId est requis pour ce rapport.');
    }

    const rows = await db
      .select({
        termName: semesters.name,
        rawScore: assessmentOutcomes.rawScore,
        maximumScoreSnapshot: assessmentOutcomes.maximumScoreSnapshot,
      })
      .from(assessmentOutcomes)
      .innerJoin(assessmentDefinitions, eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitions.id))
      .leftJoin(semesters, eq(assessmentDefinitions.termId, semesters.id))
      .where(and(
        eq(assessmentOutcomes.tenantId, tenantId),
        eq(assessmentOutcomes.studentId, params.studentId),
        eq(assessmentOutcomes.status, 'graded'),
      ));

    const byTerm = new Map<string, { total: number; max: number }>();
    for (const r of rows) {
      const term = r.termName || 'Période non assignée';
      const entry = byTerm.get(term) ?? { total: 0, max: 0 };
      entry.total += Number(r.rawScore ?? 0);
      entry.max += Number(r.maximumScoreSnapshot);
      byTerm.set(term, entry);
    }

    const periods = Array.from(byTerm.entries()).map(([period, v]) => ({
      period,
      averageScore: v.max > 0 ? Number(((v.total / v.max) * 20).toFixed(2)) : 0,
    }));

    return periods.map((p, i) => {
      const prev = periods[i - 1];
      let trendIndicator = 'Stable';
      if (prev) {
        if (p.averageScore > prev.averageScore) trendIndicator = 'Hausse';
        else if (p.averageScore < prev.averageScore) trendIndicator = 'Baisse';
      }
      return { period: p.period, averageScore: p.averageScore, trendIndicator };
    });
  }
}
