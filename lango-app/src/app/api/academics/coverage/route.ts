import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import {
  academicClassOfferings,
  classes,
  classSections,
  classSubjects,
  classTeachers,
  sections,
  sessionYears,
  subjectTeachers,
  subjects,
  user,
} from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    await requireCapability(context, 'academics.read');
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const sessionYearId = searchParams.get('sessionYearId');

    // Filter by default or requested session year
    let targetSessionId = sessionYearId;
    if (!targetSessionId) {
      const [defaultSession] = await db
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      targetSessionId = defaultSession?.id ?? null;
    }

    if (!targetSessionId) {
      return NextResponse.json({
        success: true,
        data: {
          offeringsWithoutPrimaryTeacher: [],
          subjectsWithoutTeacher: [],
          overloadedTeachers: [],
        },
      });
    }

    // 1. Offerings without an active primary teacher
    const offeringsWithoutPrimaryTeacher = await db
      .select({
        offeringId: academicClassOfferings.id,
        className: classes.name,
        sectionName: sections.name,
      })
      .from(academicClassOfferings)
      .innerJoin(classes, eq(academicClassOfferings.classId, classes.id))
      .innerJoin(sections, eq(academicClassOfferings.sectionId, sections.id))
      .leftJoin(
        classTeachers,
        and(
          eq(classTeachers.offeringId, academicClassOfferings.id),
          eq(classTeachers.role, 'primary'),
          isNull(classTeachers.endsOn),
        )
      )
      .where(and(
        eq(academicClassOfferings.tenantId, tenantId),
        eq(academicClassOfferings.sessionYearId, targetSessionId),
        eq(academicClassOfferings.status, 'active'),
        isNull(classTeachers.id),
      ));

    // 2. Class subjects without an assigned subject teacher
    const subjectsWithoutTeacher = await db
      .select({
        classSubjectId: classSubjects.id,
        className: classes.name,
        subjectName: subjects.name,
        type: classSubjects.type,
      })
      .from(classSubjects)
      .innerJoin(classes, eq(classSubjects.classId, classes.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .innerJoin(academicClassOfferings, eq(classSubjects.offeringId, academicClassOfferings.id))
      .leftJoin(
        subjectTeachers,
        and(
          eq(subjectTeachers.classSubjectId, classSubjects.id),
          eq(subjectTeachers.tenantId, tenantId),
        )
      )
      .where(and(
        eq(classSubjects.tenantId, tenantId),
        eq(academicClassOfferings.sessionYearId, targetSessionId),
        eq(classSubjects.isActive, true),
        isNull(subjectTeachers.id),
      ));

    // 3. Overloaded teachers (workloadHours >= 30)
    const overloadedTeachers = await db
      .select({
        teacherId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        workloadHours: user.workloadHours,
      })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'teacher'),
        sql`${user.workloadHours} >= 30`,
      ));

    return NextResponse.json({
      success: true,
      data: {
        sessionYearId: targetSessionId,
        offeringsWithoutPrimaryTeacher,
        subjectsWithoutTeacher,
        overloadedTeachers,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
