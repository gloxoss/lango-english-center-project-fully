import { and, asc, count, eq, inArray, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { classSectionCreateSchema, classSectionUpdateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { assertCapacityNotBelowOccupancy } from '@/libs/services/section-capacity';
import {
  academicRooms,
  attendance,
  classes,
  classScheduleSlots,
  classSections,
  classTeachers,
  rooms,
  sections,
  studentPlacements,
  subjectTeachers,
  user,
} from '@/models/Schema';

// ---------------------------------------------------------------------------
// Operating class sections (class + section label + medium).
//
// Branch inheritance: class_sections has no branchId on purpose. The
// authoritative branch is the parent class's branch, resolved through a join
// for every read AND write. Branch-limited admins only see/act on sections of
// classes in their own campus; ambiguous legacy classes (branchId NULL) are
// readable by whole-school admins only for writes.
// ---------------------------------------------------------------------------

function toApiClassSection(row: typeof classSections.$inferSelect) {
  return {
    id: row.id,
    classId: row.classId,
    sectionId: row.sectionId,
    mediumId: row.mediumId,
    maxStudents: row.maxStudents,
    homeRoomId: row.homeRoomId,
    schoolId: row.tenantId,
  };
}

/** Salle de base: accept the academic room registry (UI) or the legacy rooms table. */
async function assertRoomBelongsToTenant(tenantId: string, homeRoomId: string | null | undefined) {
  if (!homeRoomId) {
    return;
  }
  const [academicRoom] = await db
    .select({ id: academicRooms.id })
    .from(academicRooms)
    .where(and(eq(academicRooms.id, homeRoomId), eq(academicRooms.tenantId, tenantId)))
    .limit(1);
  if (academicRoom) {
    return;
  }
  const [legacyRoom] = await db.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, homeRoomId), eq(rooms.tenantId, tenantId))).limit(1);
  if (!legacyRoom) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La salle indiquée n\'existe pas pour cet établissement.');
  }
}

type Context = Awaited<ReturnType<typeof requireRequestContext>>;

/**
 * The section a caller may read/write, with its parent class. Branch-limited
 * principals are pinned to their campus; writes on an ambiguous legacy class
 * (no campus) are refused with an actionable message.
 */
async function findSectionInScope(
  context: Context,
  tenantId: string,
  sectionRowId: string,
  purpose: 'read' | 'write',
) {
  const [row] = await db
    .select({
      section: classSections,
      classBranchId: classes.branchId,
      className: classes.name,
      mediumId: classes.mediumId,
    })
    .from(classSections)
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .where(and(eq(classSections.id, sectionRowId), eq(classSections.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    return null;
  }
  if (!context.branchId) {
    return row;
  }
  if (row.classBranchId === context.branchId) {
    return row;
  }
  if (purpose === 'write' && row.classBranchId === null) {
    throw new ApiError(403, 'FORBIDDEN', 'La classe de cette section n\'est rattachée à aucun campus. Un administrateur global doit d\'abord lui attribuer un campus.');
  }
  return null;
}

/**
 * Operational blockers that make a section delete unsafe. Historical records
 * (placements, teacher/timetable links, section-scoped attendance) must never
 * be cascade-deleted by a configuration action.
 */
async function classSectionDependencyBlockers(tenantId: string, classSectionId: string) {
  const [placementRows, attendanceRows, classTeacherRows, subjectTeacherRows, slotRows, enrolledRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(studentPlacements)
      .where(and(eq(studentPlacements.tenantId, tenantId), eq(studentPlacements.classSectionId, classSectionId))),
    db
      .select({ n: count() })
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.classSectionId, classSectionId))),
    db
      .select({ n: count() })
      .from(classTeachers)
      .where(and(eq(classTeachers.tenantId, tenantId), eq(classTeachers.classSectionId, classSectionId))),
    db
      .select({ n: count() })
      .from(subjectTeachers)
      .where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.classSectionId, classSectionId))),
    db
      .select({ n: count() })
      .from(classScheduleSlots)
      .where(and(eq(classScheduleSlots.tenantId, tenantId), eq(classScheduleSlots.classSectionId, classSectionId))),
    db
      .select({ n: count() })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.classSectionId, classSectionId))),
  ]);

  return [
    { key: 'student_placements', count: Number(placementRows[0]?.n ?? 0) },
    { key: 'attendance_records', count: Number(attendanceRows[0]?.n ?? 0) },
    { key: 'enrolled_students', count: Number(enrolledRows[0]?.n ?? 0) },
    { key: 'class_teacher_assignments', count: Number(classTeacherRows[0]?.n ?? 0) },
    { key: 'subject_teacher_assignments', count: Number(subjectTeacherRows[0]?.n ?? 0) },
    { key: 'timetable_slots', count: Number(slotRows[0]?.n ?? 0) },
  ].filter(blocker => blocker.count > 0);
}

export async function GET(request: Request) {
  try {
    // Read-only structural lookup: the cash desk needs section names to allocate
    // fees, so the accountant reads it under academics.read like any other staff
    // reader. The role allowlist used to reject the account outright, which is
    // how the accountant got 403 on screens that only need names.
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant']);
    const tenantId = requireTenant(context);
    // The accountant needs these names to label fee allocations and nothing
    // else, and may hold finance powers without academics.read. So the finance
    // capability is accepted here as the alternative gate; nothing broader is
    // granted by it.
    if (context.role === 'accountant') {
      await requireCapability(context, 'finance.manage');
    } else {
      await requireCapability(context, 'academics.read');
    }
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const conditions = [eq(classSections.tenantId, tenantId)];
    const classIdFilter = searchParams.get('classId');
    if (classIdFilter) {
      conditions.push(eq(classSections.classId, classIdFilter));
    }
    // Branch inheritance: a branch-limited principal only sees sections whose
    // parent class belongs to their campus.
    if (context.branchId) {
      conditions.push(eq(classes.branchId, context.branchId));
    }
    const branchIdFilter = searchParams.get('branchId');
    if (branchIdFilter) {
      conditions.push(or(eq(classes.branchId, branchIdFilter), isNull(classes.branchId))!);
    }
    if (context.role === 'teacher') {
      const assignedIds = await getTeacherClassSectionIds(tenantId, context.userId);
      if (assignedIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          page: pagination.page,
          pageSize: pagination.pageSize,
        });
      }
      conditions.push(inArray(classSections.id, assignedIds));
    }
    const where = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      db
        .select({
          classSection: classSections,
          className: classes.name,
          classBranchId: classes.branchId,
          periodType: classes.periodType,
          sectionName: sections.name,
        })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .where(where)
        .orderBy(asc(classes.name), asc(sections.name), asc(classSections.id))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .where(where),
    ]);

    // Real live roster count per section, batched in one query (not N+1).
    const sectionIds = rows.map(r => r.classSection.id);
    const enrolledCounts = sectionIds.length > 0
      ? await db
          .select({ classSectionId: user.classSectionId, enrolledCount: count() })
          .from(user)
          .where(and(inArray(user.classSectionId, sectionIds), eq(user.role, 'student'), eq(user.tenantId, tenantId)))
          .groupBy(user.classSectionId)
      : [];
    const enrolledById = new Map(enrolledCounts.map(e => [e.classSectionId, e.enrolledCount]));

    const homeroomRows = sectionIds.length > 0
      ? await db
          .select({ classSectionId: classTeachers.classSectionId, teacherId: classTeachers.teacherId })
          .from(classTeachers)
          .where(and(
            inArray(classTeachers.classSectionId, sectionIds),
            eq(classTeachers.role, 'primary'),
            eq(classTeachers.status, 'active'),
            isNull(classTeachers.endsOn),
          ))
      : [];
    const homeroomById = new Map(homeroomRows.map(h => [h.classSectionId, h.teacherId]));

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({
        ...toApiClassSection(r.classSection),
        branchId: r.classBranchId,
        className: r.className,
        periodType: r.periodType,
        sectionName: r.sectionName,
        enrolledCount: enrolledById.get(r.classSection.id) ?? 0,
        homeroomTeacherId: homeroomById.get(r.classSection.id) ?? null,
      })),
      total: totalRows[0]?.total ?? 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// mediumId is never accepted from the client - it is always derived from the
// class, matching ESchool's denormalization intent (class_sections.medium_id
// always mirrors classes.medium_id). Also confirms classId/sectionId belong to
// this tenant and that the caller may operate on the class's campus.
async function resolveMediumId(context: Context, tenantId: string, classId: string, sectionId: string, purpose: 'read' | 'write'): Promise<string> {
  const row = await findSectionClass(context, tenantId, classId, purpose);
  const [sectionRow] = await db.select({ id: sections.id }).from(sections).where(and(eq(sections.id, sectionId), eq(sections.tenantId, tenantId))).limit(1);
  if (!sectionRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La section indiquée n\'existe pas pour cet établissement.');
  }
  return row.mediumId;
}

async function findSectionClass(context: Context, tenantId: string, classId: string, purpose: 'read' | 'write') {
  const [classRow] = await db
    .select({ id: classes.id, mediumId: classes.mediumId, branchId: classes.branchId })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId)))
    .limit(1);
  if (!classRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La classe indiquée n\'existe pas pour cet établissement.');
  }
  if (context.branchId) {
    if (classRow.branchId === context.branchId) {
      return classRow;
    }
    if (purpose === 'write' && classRow.branchId === null) {
      throw new ApiError(403, 'FORBIDDEN', 'Cette classe n\'est rattachée à aucun campus. Un administrateur global doit d\'abord lui attribuer un campus.');
    }
    throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez agir que sur les classes de votre campus.');
  }
  return classRow;
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, classSectionCreateSchema);

    const mediumId = await resolveMediumId(context, tenantId, body.classId, body.sectionId, 'write');
    await assertRoomBelongsToTenant(tenantId, body.homeRoomId);

    const [inserted] = await db
      .insert(classSections)
      .values({
        tenantId,
        classId: body.classId,
        sectionId: body.sectionId,
        mediumId,
        maxStudents: body.maxStudents,
        homeRoomId: body.homeRoomId,
      })
      .returning();

    recordAudit(context, 'create', 'class_section', inserted!.id);

    return NextResponse.json({ success: true, data: toApiClassSection(inserted!) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, classSectionUpdateSchema);

    const existing = await findSectionInScope(context, tenantId, body.id, 'write');
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    const set: { classId?: string; sectionId?: string; mediumId?: string; maxStudents?: number | null; homeRoomId?: string | null; updatedAt: string } = {
      updatedAt: new Date().toISOString(),
    };
    if (body.classId || body.sectionId) {
      const classId = body.classId ?? existing.section.classId;
      const sectionId = body.sectionId ?? existing.section.sectionId;
      set.mediumId = await resolveMediumId(context, tenantId, classId, sectionId, 'write');
      set.classId = classId;
      set.sectionId = sectionId;
    }
    if (body.maxStudents !== undefined) {
      // Capacity must never drop below the students already seated.
      if (body.maxStudents !== null) {
        await assertCapacityNotBelowOccupancy(tenantId, body.id, body.maxStudents);
      }
      set.maxStudents = body.maxStudents;
    }
    if (body.homeRoomId !== undefined) {
      await assertRoomBelongsToTenant(tenantId, body.homeRoomId);
      set.homeRoomId = body.homeRoomId;
    }

    const [updated] = await db
      .update(classSections)
      .set(set)
      .where(and(eq(classSections.id, body.id), eq(classSections.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'class_section', body.id, {
      maxStudents: body.maxStudents !== undefined ? body.maxStudents : undefined,
    });

    return NextResponse.json({ success: true, data: toApiClassSection(updated) });
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

    const existing = await findSectionInScope(context, tenantId, id, 'write');
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    const blockers = await classSectionDependencyBlockers(tenantId, id);
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SECTION_IN_USE',
            message: 'Cette section possède un historique scolaire et ne peut pas être supprimée.',
          },
          blockers,
        },
        { status: 409 },
      );
    }

    await db.delete(classSections).where(and(eq(classSections.id, id), eq(classSections.tenantId, tenantId)));
    recordAudit(context, 'delete', 'class_section', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
