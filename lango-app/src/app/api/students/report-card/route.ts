import { and, eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getClassReportCards } from '@/features/academics/services/report-card-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAnyCapability } from '@/libs/api/permissions';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { examTerms, sessionYears, user } from '@/models/Schema';

// GET /api/students/report-card?studentId= — one student's real report card.
// GET /api/students/report-card?classSectionId= — the whole class's bulletins
// (batch generation, computed in a single pass over the class roster).
// Optional ?examTermId= scopes the bulletin to that term; without it the
// tenant's default session-year window is used so a bulletin never mixes
// terms or years (audit 3, P0-F).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAnyCapability(context, ['grading.read', 'grading.review']);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const classSectionId = searchParams.get('classSectionId');
    const examTermId = searchParams.get('examTermId');

    if (!studentId && !classSectionId) {
      return NextResponse.json({ success: false, message: 'studentId ou classSectionId requis.' }, { status: 400 });
    }

    let targetClassSectionId: string;
    if (studentId) {
      const [student] = await db
        .select({ classSectionId: user.classSectionId })
        .from(user)
        .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
        .limit(1);

      if (!student) {
        return NextResponse.json({ success: false, message: 'Élève introuvable.' }, { status: 404 });
      }
      if (!student.classSectionId) {
        return NextResponse.json({ success: false, message: 'Élève non affecté à une classe.' }, { status: 422 });
      }
      targetClassSectionId = student.classSectionId;
    } else {
      targetClassSectionId = classSectionId!;
    }

    // Any teacher could pull any student's or any class's bulletins; a teacher
    // now only reaches the sections they teach.
    if (context.role === 'teacher') {
      const assigned = await getTeacherClassSectionIds(tenantId, context.userId);
      if (!assigned.includes(targetClassSectionId)) {
        throw new ApiError(403, 'FORBIDDEN', 'Cette classe ne fait pas partie de vos classes.');
      }
    }

    // Resolve the bulletin window: explicit exam term, else the active session year.
    let termWindow: { termStart?: string; termEnd?: string } = {};
    if (examTermId) {
      const [term] = await db
        .select({ startDate: examTerms.startDate, endDate: examTerms.endDate })
        .from(examTerms)
        .where(and(eq(examTerms.id, examTermId), eq(examTerms.tenantId, tenantId)))
        .limit(1);
      if (!term) {
        return NextResponse.json({ success: false, message: 'Session d\'examen introuvable.' }, { status: 404 });
      }
      termWindow = { termStart: term.startDate, termEnd: term.endDate };
    } else {
      const [year] = await db
        .select({ startDate: sessionYears.startDate, endDate: sessionYears.endDate })
        .from(sessionYears)
        .where(and(
          eq(sessionYears.tenantId, tenantId),
          or(eq(sessionYears.isDefault, true)),
        ))
        .limit(1);
      if (year) {
        termWindow = { termStart: year.startDate, termEnd: year.endDate };
      }
    }

    const { cards } = await getClassReportCards(tenantId, targetClassSectionId, termWindow);

    if (studentId) {
      return NextResponse.json({ success: true, data: cards.find(c => c.student.id === studentId) ?? null });
    }
    return NextResponse.json({ success: true, data: cards });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
