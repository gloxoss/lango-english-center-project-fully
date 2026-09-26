import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { branchWhere } from '@/libs/api/portal-scope';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import {
  attendance,
  attendanceRegisters,
  classes,
  classSections,
  sections,
  subjects,
  user,
} from '@/models/Schema';

/**
 * REGISTRES & HISTORIQUE — the administrative history surface (phase 8).
 *
 * One scoped query over the canonical marks, because every other history view
 * here was a partial answer: the marking endpoint reads a single day, and the QR
 * report reads scans. This reads marks across a range and derives the origin
 * from the mark itself (`scanEventId` present means a credential produced it),
 * so manual and QR attendances sit in one table without a second source.
 *
 * SCOPE IS SERVER-SIDE and taken from the request context, never the query
 * string: a campus-limited admin sees their campus, a teacher sees only their
 * own sections. The same filter object backs the rows, so a CSV cannot disagree
 * with what is on screen.
 *
 * Technical identifiers are NOT returned here. Event ids, credential hashes and
 * staging internals belong to the technical journal, not to a head of year
 * reading attendance.
 */
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.read');

    const { searchParams } = new URL(request.url);
    const today = casablancaTodayIso();
    // Default range: the last 30 days, which is what a follow-up usually means.
    const to = searchParams.get('to') || today;
    const from = searchParams.get('from') || to;

    const conditions = [
      eq(attendance.tenantId, tenantId),
      gte(attendance.date, from),
      lte(attendance.date, to),
      // Voided marks are history too, but they are not attendance: a voided row
      // would inflate every count on the page.
      eq(attendance.isVoided, false),
    ];

    const source = searchParams.get('source');
    if (source === 'qr') {
      conditions.push(isNotNull(attendance.scanEventId));
    } else if (source === 'manual') {
      conditions.push(isNull(attendance.scanEventId));
    }

    const status = searchParams.get('status');
    if (status && ['present', 'absent', 'late', 'excused'].includes(status)) {
      conditions.push(eq(attendance.status, status as 'present' | 'absent' | 'late' | 'excused'));
    }

    const classSectionId = searchParams.get('classSectionId');
    if (classSectionId) {
      conditions.push(eq(attendance.classSectionId, classSectionId));
    }

    const studentId = searchParams.get('studentId');
    if (studentId) {
      conditions.push(eq(attendance.studentId, studentId));
    }

    // BRANCH SCOPE: a campus-limited caller reads only their campus.
    if (context.branchId) {
      conditions.push(inArray(
        attendance.classSectionId,
        db.select({ id: classSections.id })
          .from(classSections)
          .innerJoin(classes, eq(classSections.classId, classes.id))
          .where(and(eq(classSections.tenantId, tenantId), branchWhere(context, classes.branchId))),
      ));
    }

    // TEACHER SCOPE: only sections they currently teach. A teacher with no
    // current assignment sees nothing — never everything.
    if (context.role === 'teacher') {
      const assigned = await getTeacherClassSectionIds(tenantId, context.userId);
      conditions.push(
        assigned.length > 0
          ? inArray(attendance.classSectionId, assigned)
          : sql`false`,
      );
    }

    const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '500', 10) || 500, 2000);

    const rows = await db
      .select({
        id: attendance.id,
        date: attendance.date,
        period: attendance.period,
        status: attendance.status,
        lateMinutes: attendance.lateMinutes,
        note: attendance.note,
        studentId: attendance.studentId,
        studentName: user.name,
        // Origin is derived from the mark, not passed in: a mark either has a
        // scan behind it or it was entered by a person.
        fromScan: isNotNull(attendance.scanEventId),
        registerReference: attendanceRegisters.reference,
        registerStatus: attendanceRegisters.status,
        className: classes.name,
        sectionName: sections.name,
        subjectName: subjects.name,
      })
      .from(attendance)
      .innerJoin(user, eq(attendance.studentId, user.id))
      .leftJoin(attendanceRegisters, eq(attendance.registerId, attendanceRegisters.id))
      .leftJoin(classSections, eq(attendance.classSectionId, classSections.id))
      .leftJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(sections, eq(classSections.sectionId, sections.id))
      .leftJoin(subjects, eq(attendance.subjectId, subjects.id))
      .where(and(...conditions))
      .orderBy(desc(attendance.date), asc(attendance.period))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: rows.map(row => ({
        ...row,
        source: row.fromScan ? 'qr' : 'manual',
        // One label the table can render without re-deriving it per row.
        classNameLabel: [row.className, row.sectionName].filter(Boolean).join(' · ') || null,
      })),
      meta: { from, to, count: rows.length, limit },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
