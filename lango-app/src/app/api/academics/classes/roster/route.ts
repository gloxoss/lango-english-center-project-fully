import { and, eq, gte, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { calculateMoroccanAverage } from '@/libs/grading/moroccan-grade-engine';
import { assessmentPlans, assessmentResults, assessments, attendance, classes, classSections, classSubjects, invoices, sections, user } from '@/models/Schema';

// Composite class-360 roster: real attendance rate (last 30 days), real
// payment balance, and real average grade (across every subject the class
// takes) per student - joins 4 tables that each already power their own
// page (attendance, students, finance, grade-entry) rather than a new one.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'id requis.' }, { status: 400 });
    }

    const [classRow] = await db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(and(eq(classes.id, id), eq(classes.tenantId, tenantId)))
      .limit(1);

    if (!classRow) {
      return NextResponse.json({ success: false, message: 'Classe introuvable.' }, { status: 404 });
    }

    const roster = await db
      .select({ id: user.id, name: user.name, matricule: user.matricule, sectionName: sections.name })
      .from(user)
      .innerJoin(classSections, eq(user.classSectionId, classSections.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(classSections.classId, id)));

    const studentIds = roster.map(s => s.id);
    if (studentIds.length === 0) {
      return NextResponse.json({ success: true, data: { className: classRow.name, students: [] } });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [attendanceRows, invoiceRows, gradeRows] = await Promise.all([
      db
        .select({ studentId: attendance.studentId, status: attendance.status })
        .from(attendance)
        .where(and(eq(attendance.tenantId, tenantId), inArray(attendance.studentId, studentIds), gte(attendance.date, thirtyDaysAgo))),
      db
        .select({ studentId: invoices.studentId, netAmount: invoices.netAmount, paidAmount: invoices.paidAmount })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.studentId, studentIds))),
      db
        .select({ studentId: assessmentResults.studentId, title: assessments.title, finalPercentage: assessmentResults.finalPercentage })
        .from(assessmentResults)
        .innerJoin(assessments, eq(assessmentResults.assessmentId, assessments.id))
        .innerJoin(assessmentPlans, eq(assessments.assessmentPlanId, assessmentPlans.id))
        .innerJoin(classSubjects, eq(assessmentPlans.classSubjectId, classSubjects.id))
        .where(and(eq(assessmentResults.tenantId, tenantId), inArray(assessmentResults.studentId, studentIds), eq(classSubjects.classId, id))),
    ]);

    const attendanceByStudent = new Map<string, { present: number; total: number }>();
    for (const row of attendanceRows) {
      const entry = attendanceByStudent.get(row.studentId) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (row.status === 'present') {
        entry.present += 1;
      }
      attendanceByStudent.set(row.studentId, entry);
    }

    const balanceByStudent = new Map<string, number>();
    for (const row of invoiceRows) {
      const prev = balanceByStudent.get(row.studentId) ?? 0;
      balanceByStudent.set(row.studentId, prev + Math.max(0, row.netAmount - row.paidAmount));
    }

    const gradesByStudent = new Map<string, { title: string; grade: number }[]>();
    for (const row of gradeRows) {
      if (row.finalPercentage === null) {
        continue;
      }
      const list = gradesByStudent.get(row.studentId) ?? [];
      list.push({ title: row.title, grade: Number(row.finalPercentage) });
      gradesByStudent.set(row.studentId, list);
    }

    const students = roster.map((s) => {
      const att = attendanceByStudent.get(s.id);
      const grades = gradesByStudent.get(s.id);
      const average = grades && grades.length > 0
        ? calculateMoroccanAverage(grades.map(g => ({ subjectId: s.id, subjectName: g.title, grade: g.grade, coefficient: 1 }))).generalAverage
        : null;
      return {
        id: s.id,
        name: s.name,
        matricule: s.matricule,
        sectionName: s.sectionName,
        attendanceRate: att && att.total > 0 ? Math.round((att.present / att.total) * 1000) / 10 : null,
        balanceDue: balanceByStudent.get(s.id) ?? 0,
        average,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ success: true, data: { className: classRow.name, students } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
