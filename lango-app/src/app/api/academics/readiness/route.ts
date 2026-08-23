import { and, count, countDistinct, eq, isNotNull, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import {
  academicClassOfferings,
  academicRooms,
  classScheduleSlots,
  classSections,
  classSubjects,
  classTeachers,
  sessionYears,
  subjectTeachers,
  timetableVersions,
  user,
} from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    await requireCapability(context, 'academics.read');
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const sessionYearIdParam = searchParams.get('sessionYearId');

    let targetSessionId = sessionYearIdParam;
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
          overallScore: 0,
          checks: [],
        },
      });
    }

    // 1. Total sections vs offerings
    const [[totalSections], [totalOfferings]] = await Promise.all([
      db.select({ count: count() }).from(classSections).where(eq(classSections.tenantId, tenantId)),
      db
        .select({ count: count() })
        .from(academicClassOfferings)
        .where(and(eq(academicClassOfferings.tenantId, tenantId), eq(academicClassOfferings.sessionYearId, targetSessionId))),
    ]);

    const sectionCoverage = totalSections?.count ? Math.min(100, Math.round(((totalOfferings?.count ?? 0) / totalSections.count) * 100)) : 100;

    // 2. Primary teachers assigned
    const [offeringsWithPrimary] = await db
      .select({ count: count() })
      .from(academicClassOfferings)
      .innerJoin(
        classTeachers,
        and(
          eq(classTeachers.offeringId, academicClassOfferings.id),
          eq(classTeachers.role, 'primary'),
          isNull(classTeachers.endsOn),
        )
      )
      .where(and(eq(academicClassOfferings.tenantId, tenantId), eq(academicClassOfferings.sessionYearId, targetSessionId)));

    const primaryCoverage = totalOfferings?.count ? Math.min(100, Math.round(((offeringsWithPrimary?.count ?? 0) / totalOfferings.count) * 100)) : 100;

    // 3. Subject teachers assigned
    const [[totalClassSubjects], [assignedSubjects]] = await Promise.all([
      db.select({ count: count() }).from(classSubjects).where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.isActive, true))),
      db
        .select({ count: countDistinct(classSubjects.id) })
        .from(classSubjects)
        .innerJoin(subjectTeachers, eq(subjectTeachers.classSubjectId, classSubjects.id))
        .where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.isActive, true))),
    ]);

    const subjectCoverage = totalClassSubjects?.count ? Math.min(100, Math.round(((assignedSubjects?.count ?? 0) / totalClassSubjects.count) * 100)) : 100;

    // 4. Timetable published check
    const [publishedTimetable] = await db
      .select({ id: timetableVersions.id })
      .from(timetableVersions)
      .where(and(
        eq(timetableVersions.tenantId, tenantId),
        eq(timetableVersions.sessionYearId, targetSessionId),
        eq(timetableVersions.status, 'published'),
      ))
      .limit(1);

    const timetableScore = publishedTimetable ? 100 : 0;

    // 5. Rooms allocated
    const [[totalSlots], [slotsWithRoom]] = await Promise.all([
      db.select({ count: count() }).from(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId)),
      db.select({ count: count() }).from(classScheduleSlots).where(and(eq(classScheduleSlots.tenantId, tenantId), isNotNull(classScheduleSlots.roomLabel))),
    ]);

    const roomScore = totalSlots?.count ? Math.min(100, Math.round(((slotsWithRoom?.count ?? 0) / totalSlots.count) * 100)) : 100;

    // 6. Student Placement Rate (role = 'student')
    const [[totalStudents], [placedStudents]] = await Promise.all([
      db.select({ count: count() }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'))),
      db.select({ count: count() }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), isNotNull(user.classSectionId))),
    ]);

    const studentScore = totalStudents?.count ? Math.min(100, Math.round(((placedStudents?.count ?? 0) / totalStudents.count) * 100)) : 100;

    // Aggregate overall readiness score
    const scores = [sectionCoverage, primaryCoverage, subjectCoverage, timetableScore, roomScore, studentScore];
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const checks = [
      {
        id: 'class_offerings',
        title: 'Offres de Classes',
        score: sectionCoverage,
        status: sectionCoverage >= 90 ? 'conforme' : sectionCoverage >= 50 ? 'attention' : 'critique',
        detail: `${totalOfferings?.count ?? 0} / ${totalSections?.count ?? 0} sections ouvertes en offres.`,
      },
      {
        id: 'primary_teachers',
        title: 'Professeurs Principaux / Titulaires',
        score: primaryCoverage,
        status: primaryCoverage >= 90 ? 'conforme' : primaryCoverage >= 50 ? 'attention' : 'critique',
        detail: `${offeringsWithPrimary?.count ?? 0} / ${totalOfferings?.count ?? 0} classes ont un titulaire assigné.`,
      },
      {
        id: 'subject_teachers',
        title: 'Attribution des Matières',
        score: subjectCoverage,
        status: subjectCoverage >= 90 ? 'conforme' : subjectCoverage >= 50 ? 'attention' : 'critique',
        detail: `${assignedSubjects?.count ?? 0} / ${totalClassSubjects?.count ?? 0} matières ont un enseignant assigné.`,
      },
      {
        id: 'timetable_published',
        title: 'Publication Emploi du Temps',
        score: timetableScore,
        status: timetableScore === 100 ? 'conforme' : 'critique',
        detail: publishedTimetable ? 'Emploi du temps officiel publié.' : 'Aucun emploi du temps publié pour cette session.',
      },
      {
        id: 'rooms_allocated',
        title: 'Salles de Cours Affectées',
        score: roomScore,
        status: roomScore >= 90 ? 'conforme' : roomScore >= 50 ? 'attention' : 'critique',
        detail: `${slotsWithRoom?.count ?? 0} / ${totalSlots?.count ?? 0} créneaux ont une salle attribuée.`,
      },
      {
        id: 'student_placements',
        title: 'Réinscription & Affectation Élèves',
        score: studentScore,
        status: studentScore >= 90 ? 'conforme' : studentScore >= 50 ? 'attention' : 'critique',
        detail: `${placedStudents?.count ?? 0} / ${totalStudents?.count ?? 0} élèves affectés dans une section.`,
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        sessionYearId: targetSessionId,
        overallScore,
        checks,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
