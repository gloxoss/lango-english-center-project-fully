import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAnyCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { getClassReportCards } from '@/features/academics/services/report-card-service';
import { user } from '@/models/Schema';

// GET /api/students/report-card?studentId= — one student's real report card.
// GET /api/students/report-card?classSectionId= — the whole class's bulletins
// (batch generation, computed in a single pass over the class roster).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAnyCapability(context, ['grading.read', 'grading.review']);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const classSectionId = searchParams.get('classSectionId');

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

    const { cards } = await getClassReportCards(tenantId, targetClassSectionId);

    if (studentId) {
      return NextResponse.json({ success: true, data: cards.find(c => c.student.id === studentId) ?? null });
    }
    return NextResponse.json({ success: true, data: cards });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
