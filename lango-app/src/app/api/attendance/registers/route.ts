import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { attendanceRegisters, classes, classSections, user } from '@/models/Schema';

const registerProjection = {
  id: attendanceRegisters.id,
  reference: attendanceRegisters.reference,
  status: attendanceRegisters.status,
  submittedAt: attendanceRegisters.submittedAt,
  submittedById: attendanceRegisters.submittedById,
  submittedByName: user.name,
  reopenedAt: attendanceRegisters.reopenedAt,
  reopenReason: attendanceRegisters.reopenReason,
  correctionNote: attendanceRegisters.correctionNote,
} as const;

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const date = searchParams.get('date');
    const periodParam = searchParams.get('period');

    if (!classId || !date) {
      return NextResponse.json({ success: true, data: null });
    }

    const period = periodParam ? Number.parseInt(periodParam, 10) : 1;

    // SECTION SCOPE (migration 0147): resolve the operating section first, so
    // Section A and Section B read independent registers. If the section has
    // no register yet, fall back to a legacy class-level register (historical
    // rows whose section identity was never stored).
    const [sec] = await db
      .select({ id: classSections.id, classId: classSections.classId, branchId: classes.branchId })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .where(and(eq(classSections.tenantId, tenantId), eq(classSections.id, classId)))
      .limit(1);

    // AUTHORITATIVE SCOPE (P0): branch-limited callers only read registers of
    // their campus; teachers only registers of their assigned sections.
    if (sec) {
      if (context.branchId && sec.branchId !== context.branchId) {
        return NextResponse.json({ success: true, data: null });
      }
      if (context.role === 'teacher') {
        const assignedIds = await getTeacherClassSectionIds(tenantId, context.userId);
        if (!assignedIds.includes(sec.id)) {
          return NextResponse.json({ success: true, data: null });
        }
      }
    } else {
      // Legacy class-level register (no section identity): whole-school admins
      // and matching-campus admins only; teachers never read these.
      if (context.role === 'teacher') {
        return NextResponse.json({ success: true, data: null });
      }
      if (context.branchId) {
        const [cls] = await db
          .select({ branchId: classes.branchId })
          .from(classes)
          .where(and(eq(classes.tenantId, tenantId), eq(classes.id, classId)))
          .limit(1);
        if (!cls || cls.branchId !== context.branchId) {
          return NextResponse.json({ success: true, data: null });
        }
      }
    }

    const classKey = sec?.classId ?? classId;

    const [sectionRow] = await db
      .select(registerProjection)
      .from(attendanceRegisters)
      .leftJoin(user, eq(attendanceRegisters.submittedById, user.id))
      .where(and(
        eq(attendanceRegisters.tenantId, tenantId),
        eq(attendanceRegisters.classId, classKey),
        eq(attendanceRegisters.date, date),
        eq(attendanceRegisters.period, period),
        sec ? eq(attendanceRegisters.classSectionId, sec.id) : isNull(attendanceRegisters.classSectionId),
      ))
      .limit(1);

    if (sectionRow || !sec) {
      return NextResponse.json({ success: true, data: sectionRow ?? null });
    }

    const [legacyRow] = await db
      .select(registerProjection)
      .from(attendanceRegisters)
      .leftJoin(user, eq(attendanceRegisters.submittedById, user.id))
      .where(and(
        eq(attendanceRegisters.tenantId, tenantId),
        eq(attendanceRegisters.classId, classKey),
        eq(attendanceRegisters.date, date),
        eq(attendanceRegisters.period, period),
        isNull(attendanceRegisters.classSectionId),
      ))
      .limit(1);

    return NextResponse.json({ success: true, data: legacyRow ?? null });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
