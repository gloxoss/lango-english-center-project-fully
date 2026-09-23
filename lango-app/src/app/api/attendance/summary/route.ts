import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { getGuardianChildIds } from '@/libs/api/guardian-scope';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { attendanceSummary, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'student', 'parent']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get('studentId');

    const conditions = [eq(attendanceSummary.tenantId, tenantId)];

    if (context.role === 'student') {
      conditions.push(eq(attendanceSummary.studentId, context.userId));
    } else if (context.role === 'parent') {
      // GUARDIAN SCOPE (P0): a parent only ever reads their own linked
      // children. An unlinked studentId yields an empty result, not data.
      const childIds = await getGuardianChildIds(tenantId, context.userId);
      if (childIds.length === 0) {
        return NextResponse.json({ success: true, data: [], total: 0 });
      }
      if (studentIdParam) {
        if (!childIds.includes(studentIdParam)) {
          return NextResponse.json({ success: true, data: [], total: 0 });
        }
        conditions.push(eq(attendanceSummary.studentId, studentIdParam));
      } else {
        conditions.push(inArray(attendanceSummary.studentId, childIds));
      }
    } else if (context.role === 'teacher') {
      // TEACHER SCOPE (P0): summaries only for students currently in the
      // teacher's authorized sections.
      const assignedIds = await getTeacherClassSectionIds(tenantId, context.userId);
      if (assignedIds.length === 0) {
        return NextResponse.json({ success: true, data: [], total: 0 });
      }
      if (studentIdParam) {
        conditions.push(eq(attendanceSummary.studentId, studentIdParam));
      }
      conditions.push(inArray(user.classSectionId, assignedIds));
    } else if (studentIdParam) {
      conditions.push(eq(attendanceSummary.studentId, studentIdParam));
    }

    // BRANCH SCOPE (P0): branch-limited callers only see their campus.
    if (context.branchId) {
      conditions.push(eq(user.branchId, context.branchId));
    }

    // BATCH SCOPE (Phase 7B): roster consumers request a bounded student set in
    // one call (max 200); every role/branch scope above still applies, so a
    // batch can never widen access.
    const studentIdsParam = searchParams.get('studentIds');
    if (studentIdsParam) {
      const ids = studentIdsParam.split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length === 0 || ids.length > 200) {
        throw new ApiError(400, 'INVALID_QUERY', 'studentIds doit contenir entre 1 et 200 identifiants.');
      }
      conditions.push(inArray(attendanceSummary.studentId, ids));
    }

    const rows = await db
      .select({
        id: attendanceSummary.id,
        studentId: attendanceSummary.studentId,
        studentName: user.name,
        totalPresent: attendanceSummary.totalPresent,
        totalAbsent: attendanceSummary.totalAbsent,
        totalLate: attendanceSummary.totalLate,
        totalExcused: attendanceSummary.totalExcused,
        totalSessions: attendanceSummary.totalSessions,
        attendanceRate: attendanceSummary.attendanceRate,
        lastUpdated: attendanceSummary.lastUpdated,
      })
      .from(attendanceSummary)
      .innerJoin(user, eq(attendanceSummary.studentId, user.id))
      .where(and(...conditions));

    if (studentIdParam && rows.length > 0) {
      return NextResponse.json({
        success: true,
        data: rows[0],
      });
    }

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
