import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { calculateMoroccanAverage } from '@/libs/grading/moroccan-grade-engine';
import { assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { attendance, classes, classSections, classSubjects, invoices, sections, user } from '@/models/Schema';

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
      .select({ id: classes.id, name: classes.name, branchId: classes.branchId })
      .from(classes)
      .where(and(eq(classes.id, id), eq(classes.tenantId, tenantId)))
      .limit(1);

    if (!classRow) {
      return NextResponse.json({ success: false, message: 'Classe introuvable.' }, { status: 404 });
    }
    assertBranchScope(context, classRow.branchId);

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

    // teacher has students.read/academics.read here, not finance.read -
    // balanceDue is billing data and must not ride along (same boundary as
    // the /api/students detail route).
    const canSeeFinance = context.role !== 'teacher';

    const [attendanceRows, invoiceRows, gradeRows] = await Promise.all([
      db
        .select({ studentId: attendance.studentId, status: attendance.status })
        .from(attendance)
        .where(and(eq(attendance.tenantId, tenantId), inArray(attendance.studentId, studentIds), gte(attendance.date, thirtyDaysAgo), eq(attendance.isVoided, false))),
      canSeeFinance
        ? db
            .select({ studentId: invoices.studentId, netAmount: invoices.netAmount, paidAmount: invoices.paidAmount })
            .from(invoices)
            .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.studentId, studentIds)))
        : Promise.resolve([]),
      db
        .select({
          studentId: assessmentOutcomes.studentId,
          title: assessmentDefinitions.title,
          score20: assessmentOutcomes.normalizedScore,
        })
        .from(assessmentOutcomes)
        .innerJoin(assessmentDefinitions, eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefinitions.id))
        .innerJoin(classSubjects, eq(assessmentDefinitions.classSubjectId, classSubjects.id))
        .where(and(
          eq(assessmentOutcomes.tenantId, tenantId),
          inArray(assessmentOutcomes.studentId, studentIds),
          eq(classSubjects.classId, id),
          eq(assessmentOutcomes.status, 'graded'),
          sql`${assessmentOutcomes.normalizedScore} is not null`,
        )),
    ]);

    const attendanceByStudent = new Map<string, { attended: number; total: number }>();
    for (const row of attendanceRows) {
      const entry = attendanceByStudent.get(row.studentId) ?? { attended: 0, total: 0 };
      entry.total += 1;
      // PHYSICAL PRESENCE: present + late are in the room. An excused absence is
      // still an absence — it is justified, not attended, and counting it here
      // reported a different rate than the canonical aggregate for the same
      // student.
      if (row.status === 'present' || row.status === 'late') {
        entry.attended += 1;
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
      if (row.score20 === null) {
        continue;
      }
      const list = gradesByStudent.get(row.studentId) ?? [];
      list.push({ title: row.title, grade: Number(row.score20) });
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
        attendanceRate: att && att.total > 0 ? Math.round((att.attended / att.total) * 1000) / 10 : null,
        balanceDue: canSeeFinance ? (balanceByStudent.get(s.id) ?? 0) : null,
        average,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ success: true, data: { className: classRow.name, students } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
