import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, scheduleSlotCreateSchema, scheduleSlotUpdateSchema } from '@/libs/api/validation';
import { assertSlotIsValid } from '@/libs/services/timetable-validation';
import { db } from '@/libs/DB';
import { classes, classScheduleSlots, classSections, classSubjects, sections, sessionYears, subjects, timetableVersions, user } from '@/models/Schema';

function toApiSlot(row: typeof classScheduleSlots.$inferSelect) {
  return row;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get('classSectionId');
    const offeringId = searchParams.get('offeringId');
    const roomLabel = searchParams.get('roomLabel');
    let versionId = searchParams.get('versionId');

    // Teachers can only ever see their own schedule - self-scope regardless
    // of what teacherId (if any) they pass; school_admin can filter freely.
    const teacherId = context.role === 'teacher' ? context.userId : searchParams.get('teacherId');

    // If versionId is not supplied, default to the currently published version for default session
    if (!versionId) {
      const [defaultSession] = await db
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);

      if (defaultSession) {
        const [publishedVer] = await db
          .select({ id: timetableVersions.id })
          .from(timetableVersions)
          .where(and(
            eq(timetableVersions.tenantId, tenantId),
            eq(timetableVersions.sessionYearId, defaultSession.id),
            eq(timetableVersions.status, 'published'),
          ))
          .limit(1);

        if (publishedVer) {
          versionId = publishedVer.id;
        }
      }
    }

    const filters = [eq(classScheduleSlots.tenantId, tenantId)];
    if (versionId) {
      filters.push(eq(classScheduleSlots.versionId, versionId));
    }
    if (classSectionId) {
      filters.push(eq(classScheduleSlots.classSectionId, classSectionId));
    }
    if (offeringId) {
      filters.push(eq(classScheduleSlots.offeringId, offeringId));
    }
    if (teacherId) {
      filters.push(eq(classScheduleSlots.teacherId, teacherId));
    }
    if (roomLabel) {
      filters.push(eq(classScheduleSlots.roomLabel, roomLabel));
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
        offeringId: classScheduleSlots.offeringId,
        versionId: classScheduleSlots.versionId,
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
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, scheduleSlotCreateSchema);

    await assertSlotIsValid(tenantId, body);

    const [inserted] = await db
      .insert(classScheduleSlots)
      .values({ tenantId, ...body })
      .returning();

    recordAudit(context, 'create', 'class_schedule_slot', inserted!.id);

    return NextResponse.json({ success: true, data: toApiSlot(inserted!), message: 'Créneau ajouté à l\'emploi du temps' }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, scheduleSlotUpdateSchema);

    const [existing] = await db.select().from(classScheduleSlots).where(and(eq(classScheduleSlots.id, body.id), eq(classScheduleSlots.tenantId, tenantId))).limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Créneau introuvable.');
    }

    const merged = {
      classSectionId: body.classSectionId ?? existing.classSectionId,
      classSubjectId: body.classSubjectId ?? existing.classSubjectId,
      teacherId: body.teacherId ?? existing.teacherId,
      dayOfWeek: body.dayOfWeek ?? existing.dayOfWeek,
      startTime: body.startTime ?? existing.startTime,
      endTime: body.endTime ?? existing.endTime,
      roomLabel: body.roomLabel !== undefined ? body.roomLabel : existing.roomLabel,
      offeringId: body.offeringId !== undefined ? body.offeringId : existing.offeringId,
      versionId: body.versionId !== undefined ? body.versionId : existing.versionId,
    };
    await assertSlotIsValid(tenantId, merged, body.id);

    const [updated] = await db
      .update(classScheduleSlots)
      .set({
        ...merged,
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
    await requireCapability(context, 'academics.manage');
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
