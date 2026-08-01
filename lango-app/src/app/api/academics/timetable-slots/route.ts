import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson, scheduleSlotCreateSchema, scheduleSlotUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classes, classScheduleSlots, classSections, classSubjects, sections, subjects, user } from '@/models/Schema';

async function assertReferencesBelongToTenant(tenantId: string, refs: { classSectionId: string; classSubjectId: string; teacherId: string }) {
  const [sectionRow] = await db.select({ id: classSections.id }).from(classSections).where(and(eq(classSections.id, refs.classSectionId), eq(classSections.tenantId, tenantId))).limit(1);
  if (!sectionRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La classe/section indiquée n\'existe pas pour cet établissement.');
  }
  const [subjectRow] = await db.select({ id: classSubjects.id }).from(classSubjects).where(and(eq(classSubjects.id, refs.classSubjectId), eq(classSubjects.tenantId, tenantId))).limit(1);
  if (!subjectRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La matière de classe indiquée n\'existe pas pour cet établissement.');
  }
  const [teacherRow] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, refs.teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher'))).limit(1);
  if (!teacherRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'L\'enseignant indiqué n\'existe pas pour cet établissement.');
  }
}

function toApiSlot(row: {
  id: string;
  classSectionId: string;
  classSubjectId: string;
  teacherId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomLabel: string | null;
}) {
  return row;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get('classSectionId');

    const filters = [eq(classScheduleSlots.tenantId, tenantId)];
    if (classSectionId) {
      filters.push(eq(classScheduleSlots.classSectionId, classSectionId));
    }

    const rows = await db
      .select({
        id: classScheduleSlots.id,
        classSectionId: classScheduleSlots.classSectionId,
        classSubjectId: classScheduleSlots.classSubjectId,
        teacherId: classScheduleSlots.teacherId,
        dayOfWeek: classScheduleSlots.dayOfWeek,
        startTime: classScheduleSlots.startTime,
        endTime: classScheduleSlots.endTime,
        roomLabel: classScheduleSlots.roomLabel,
        className: classes.name,
        sectionName: sections.name,
        subjectName: subjects.name,
        teacherName: user.name,
      })
      .from(classScheduleSlots)
      .innerJoin(classSections, eq(classScheduleSlots.classSectionId, classSections.id))
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .innerJoin(classSubjects, eq(classScheduleSlots.classSubjectId, classSubjects.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .innerJoin(user, eq(classScheduleSlots.teacherId, user.id))
      .where(and(...filters));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, scheduleSlotCreateSchema);

    await assertReferencesBelongToTenant(tenantId, body);

    const [inserted] = await db
      .insert(classScheduleSlots)
      .values({ tenantId, ...body })
      .returning();

    recordAudit(context, 'create', 'class_schedule_slot', inserted!.id);

    return NextResponse.json({ success: true, data: toApiSlot(inserted!), message: 'Créneau ajouté à l\'emploi du temps' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, scheduleSlotUpdateSchema);

    const [existing] = await db.select().from(classScheduleSlots).where(and(eq(classScheduleSlots.id, body.id), eq(classScheduleSlots.tenantId, tenantId))).limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Créneau introuvable.');
    }

    const merged = {
      classSectionId: body.classSectionId ?? existing.classSectionId,
      classSubjectId: body.classSubjectId ?? existing.classSubjectId,
      teacherId: body.teacherId ?? existing.teacherId,
    };
    await assertReferencesBelongToTenant(tenantId, merged);

    const [updated] = await db
      .update(classScheduleSlots)
      .set({
        ...merged,
        dayOfWeek: body.dayOfWeek ?? existing.dayOfWeek,
        startTime: body.startTime ?? existing.startTime,
        endTime: body.endTime ?? existing.endTime,
        roomLabel: body.roomLabel !== undefined ? body.roomLabel : existing.roomLabel,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(classScheduleSlots.id, body.id), eq(classScheduleSlots.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'class_schedule_slot', body.id);

    return NextResponse.json({ success: true, data: toApiSlot(updated!), message: 'Créneau mis à jour' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    await db.delete(classScheduleSlots).where(and(eq(classScheduleSlots.id, id), eq(classScheduleSlots.tenantId, tenantId)));
    recordAudit(context, 'delete', 'class_schedule_slot', id);

    return NextResponse.json({ success: true, message: 'Créneau supprimé', id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
