import type { ClassCycle } from '@/features/academics/services/filiere-structure';
import { and, asc, count, eq, ilike, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import {
  cycleAllowsFiliere,
  filiereIsAssignable,
} from '@/features/academics/services/filiere-structure';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { classCreateSchema, classUpdateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import {
  academicClassOfferings,
  assessmentPlans,
  attendance,
  attendanceRegisters,
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  classTeachers,
  mediums,
  sections,
  semesters,
  shifts,
  streams,
  studentPlacements,
  subjectTeachers,
  user,
} from '@/models/Schema';

// ---------------------------------------------------------------------------
// Classes & Niveaux — authoritative structure API.
//
// Branch scope: a branch-limited admin is pinned to their home branch for
// every read AND write; a whole-school admin may act across campuses and may
// explicitly assign a campus (including to legacy "Campus non défini" rows).
// class_sections inherit the parent class's branch, so every class operation
// resolves branch through `classes.branchId`.
//
// Delete safety: a class with any operational history (sections, placements,
// attendance/registers, offerings, curriculum, teacher/timetable links) can no
// longer be hard-deleted; the API answers 409 CLASS_IN_USE with blockers.
// ---------------------------------------------------------------------------

function toApiClass(row: typeof classes.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    includeSemesters: row.includeSemesters,
    periodType: row.periodType,
    mediumId: row.mediumId,
    shiftId: row.shiftId,
    streamId: row.streamId,
    branchId: row.branchId,
    cycle: row.cycle,
    schoolId: row.tenantId,
  };
}

/** Validate a client-supplied branch; branch-limited admins are pinned. */
async function resolveWritableBranch(
  context: Awaited<ReturnType<typeof requireRequestContext>>,
  tenantId: string,
  requested: string | null | undefined,
): Promise<string | null> {
  if (context.branchId) {
    if (requested && requested !== context.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez agir que sur le campus auquel votre compte est rattaché.');
    }
    return context.branchId;
  }
  if (requested) {
    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, requested), eq(branches.tenantId, tenantId), eq(branches.isActive, true)))
      .limit(1);
    if (!branch) {
      throw new ApiError(422, 'INVALID_BRANCH', 'Le campus sélectionné n\'existe pas pour cet établissement.');
    }
    return requested;
  }
  // DB4: at a school WITH campuses, a class is never created campusless —
  // the caller must choose. Branchless schools keep branchless classes.
  const [anyBranch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.tenantId, tenantId), eq(branches.isActive, true)))
    .limit(1);
  if (anyBranch) {
    throw new ApiError(422, 'BRANCH_REQUIRED', 'Le campus est requis : choisissez un campus pour cette classe.');
  }
  return null;
}

/** The class a caller may read/write, or null. Legacy NULL classes are only mutable by whole-school admins. */
async function findClassInScope(
  context: Awaited<ReturnType<typeof requireRequestContext>>,
  tenantId: string,
  classId: string,
  opts: { purpose: 'read' | 'write' } = { purpose: 'read' },
) {
  const [row] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    return null;
  }
  if (!context.branchId) {
    return row;
  }
  if (row.branchId === context.branchId) {
    return row;
  }
  if (opts.purpose === 'write' && row.branchId === null) {
    throw new ApiError(403, 'FORBIDDEN', 'Cette classe n\'est rattachée à aucun campus. Un administrateur global doit d\'abord lui attribuer un campus.');
  }
  return null;
}

// A client-sent mediumId/shiftId/streamId belonging to a different tenant must
// never silently succeed (it would let tenant A read/link tenant B's reference
// data) or leak a raw FK-violation error - reject it explicitly, up front.
async function assertSameTenantReferences(tenantId: string, refs: { mediumId?: string; shiftId?: string | null; streamId?: string | null; cycle?: string | null }) {
  if (refs.mediumId) {
    const [row] = await db.select({ id: mediums.id }).from(mediums).where(and(eq(mediums.id, refs.mediumId), eq(mediums.tenantId, tenantId))).limit(1);
    if (!row) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Le modèle linguistique indiqué n\'existe pas pour cet établissement.');
    }
  }
  if (refs.shiftId) {
    const [row] = await db.select({ id: shifts.id }).from(shifts).where(and(eq(shifts.id, refs.shiftId), eq(shifts.tenantId, tenantId))).limit(1);
    if (!row) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Le créneau horaire indiqué n\'existe pas pour cet établissement.');
    }
  }
  if (refs.streamId) {
    const [row] = await db
      .select({ id: streams.id, cycle: streams.cycle, isActive: streams.isActive })
      .from(streams)
      .where(and(eq(streams.id, refs.streamId), eq(streams.tenantId, tenantId)))
      .limit(1);
    if (!row) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La filière indiquée n\'existe pas pour cet établissement.');
    }

    const assignable = filiereIsAssignable(row);
    if (!assignable.allowed) {
      throw new ApiError(422, assignable.code, assignable.message);
    }

    const cycleCheck = cycleAllowsFiliere(row.cycle, (refs.cycle ?? null) as ClassCycle | null);
    if (!cycleCheck.allowed) {
      throw new ApiError(422, cycleCheck.code, cycleCheck.message);
    }
  }
}

/**
 * Operational blockers that make a class delete unsafe. Batched counts, one
 * query each; returned to the client so the administrator knows exactly why.
 */
async function classDependencyBlockers(tenantId: string, classId: string) {
  const sectionIds = db
    .select({ id: classSections.id })
    .from(classSections)
    .where(and(eq(classSections.tenantId, tenantId), eq(classSections.classId, classId)));
  const classSubjectIds = db
    .select({ id: classSubjects.id })
    .from(classSubjects)
    .where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.classId, classId)));

  const [sectionRows, placementRows, attendanceRows, registerRows, offeringRows, subjectRows, classTeacherRows, subjectTeacherRows, slotRows, planRows, definitionRows] = await Promise.all([
    db.select({ n: count() }).from(classSections).where(and(eq(classSections.tenantId, tenantId), eq(classSections.classId, classId))),
    db.select({ n: count() }).from(studentPlacements).where(and(eq(studentPlacements.tenantId, tenantId), inArray(studentPlacements.classSectionId, sectionIds))),
    db.select({ n: count() }).from(attendance).where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentGroupId, classId))),
    db.select({ n: count() }).from(attendanceRegisters).where(and(eq(attendanceRegisters.tenantId, tenantId), eq(attendanceRegisters.classId, classId))),
    db.select({ n: count() }).from(academicClassOfferings).where(and(eq(academicClassOfferings.tenantId, tenantId), eq(academicClassOfferings.classId, classId))),
    db.select({ n: count() }).from(classSubjects).where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.classId, classId))),
    db.select({ n: count() }).from(classTeachers).where(and(eq(classTeachers.tenantId, tenantId), inArray(classTeachers.classSectionId, sectionIds))),
    db.select({ n: count() }).from(subjectTeachers).where(and(eq(subjectTeachers.tenantId, tenantId), inArray(subjectTeachers.classSectionId, sectionIds))),
    db.select({ n: count() }).from(classScheduleSlots).where(and(eq(classScheduleSlots.tenantId, tenantId), inArray(classScheduleSlots.classSectionId, sectionIds))),
    db.select({ n: count() }).from(assessmentPlans).where(and(eq(assessmentPlans.tenantId, tenantId), inArray(assessmentPlans.classSubjectId, classSubjectIds))),
    // Canonical assessments carry no FK to class_subjects; count them so a
    // class with real grades is never deleted.
    db.select({ n: count() }).from(assessmentDefinitions).where(and(eq(assessmentDefinitions.tenantId, tenantId), inArray(assessmentDefinitions.classSubjectId, classSubjectIds))),
  ]);

  return [
    { key: 'sections', count: Number(sectionRows[0]?.n ?? 0) },
    { key: 'student_placements', count: Number(placementRows[0]?.n ?? 0) },
    { key: 'attendance_records', count: Number(attendanceRows[0]?.n ?? 0) },
    { key: 'attendance_registers', count: Number(registerRows[0]?.n ?? 0) },
    { key: 'academic_offerings', count: Number(offeringRows[0]?.n ?? 0) },
    { key: 'class_subjects', count: Number(subjectRows[0]?.n ?? 0) },
    { key: 'class_teacher_assignments', count: Number(classTeacherRows[0]?.n ?? 0) },
    { key: 'subject_teacher_assignments', count: Number(subjectTeacherRows[0]?.n ?? 0) },
    { key: 'timetable_slots', count: Number(slotRows[0]?.n ?? 0) },
    { key: 'assessment_plans', count: Number(planRows[0]?.n ?? 0) },
    { key: 'assessments', count: Number(definitionRows[0]?.n ?? 0) },
  ].filter(blocker => blocker.count > 0);
}

export async function GET(request: Request) {
  try {
    // ponytail: teachers need read access for attendance-page class filters
    // (POST /api/attendance already allows teacher); accountant needs it for
    // the fee-allocation class picker - writes stay school_admin-only below.
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const search = searchParams.get('search')?.trim();

    const conditions = [eq(classes.tenantId, tenantId)];
    if (context.branchId) {
      conditions.push(eq(classes.branchId, context.branchId));
    }
    if (search) {
      conditions.push(ilike(classes.name, `%${search}%`));
    }
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(classes)
        .where(where)
        // Stable ordering: campus (nulls last), then name, then primary key.
        .orderBy(asc(classes.branchId), asc(classes.name), asc(classes.id))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(classes).where(where),
    ]);

    const classIds = rows.map(row => row.id);

    // Batched operational aggregates — one query each, never per-class N+1.
    const [sectionAggregates, subjectAggregates, placementAggregates, branchRows, semesterCountRows] = await Promise.all([
      classIds.length === 0
        ? Promise.resolve([] as { classId: string; sections: number; capacityTotal: number; capacityConfigured: number }[])
        : db
            .select({
              classId: classSections.classId,
              sections: count(),
              capacityTotal: sql<number>`coalesce(sum(${classSections.maxStudents}), 0)`,
              capacityConfigured: sql<number>`count(${classSections.maxStudents})`,
            })
            .from(classSections)
            .where(and(eq(classSections.tenantId, tenantId), inArray(classSections.classId, classIds)))
            .groupBy(classSections.classId),
      classIds.length === 0
        ? Promise.resolve([] as { classId: string; subjects: number }[])
        : db
            .select({ classId: classSubjects.classId, subjects: count() })
            .from(classSubjects)
            .where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.isActive, true), inArray(classSubjects.classId, classIds)))
            .groupBy(classSubjects.classId),
      classIds.length === 0
        ? Promise.resolve([] as { classId: string; students: number }[])
        : db
            .select({ classId: classSections.classId, students: count(user.id) })
            .from(classSections)
            .innerJoin(user, and(eq(user.classSectionId, classSections.id), eq(user.tenantId, tenantId), eq(user.role, 'student')))
            .where(and(eq(classSections.tenantId, tenantId), inArray(classSections.classId, classIds)))
            .groupBy(classSections.classId),
      db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.tenantId, tenantId)).orderBy(asc(branches.name)),
      db.select({ n: count() }).from(semesters).where(eq(semesters.tenantId, tenantId)),
    ]);

    const sectionsByClass = new Map(sectionAggregates.map(row => [row.classId, row]));
    const subjectsByClass = new Map(subjectAggregates.map(row => [row.classId, row]));
    const studentsByClass = new Map(placementAggregates.map(row => [row.classId, row]));
    const branchNames = new Map(branchRows.map(branch => [branch.id, branch.name]));

    return NextResponse.json({
      success: true,
      data: rows.map((row) => {
        const sections = sectionsByClass.get(row.id);
        const capacityTotal = Number(sections?.capacityTotal ?? 0);
        const capacityConfigured = Number(sections?.capacityConfigured ?? 0);
        return {
          ...toApiClass(row),
          branchName: row.branchId ? branchNames.get(row.branchId) ?? null : null,
          sectionCount: Number(sections?.sections ?? 0),
          studentCount: Number(studentsByClass.get(row.id)?.students ?? 0),
          capacityTotal,
          // Every section must define capacity for the class to be "configured".
          capacityConfigured: Number(sections?.sections ?? 0) > 0 && capacityConfigured === Number(sections?.sections ?? 0),
          subjectCount: Number(subjectsByClass.get(row.id)?.subjects ?? 0),
        };
      }),
      total: totalRows[0]?.total ?? 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
      academicPeriodsConfigured: Number(semesterCountRows[0]?.n ?? 0) > 0,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, classCreateSchema);

    await assertSameTenantReferences(tenantId, body);
    // Authoritative campus: pinned for branch-limited admins, validated for
    // whole-school admins, NULL ("Campus non défini") only when not provided.
    const branchId = await resolveWritableBranch(context, tenantId, body.branchId);

    if (body.teacherId) {
      const [teacher] = await db.select({ id: user.id, branchId: user.branchId }).from(user).where(and(eq(user.id, body.teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher'))).limit(1);
      if (!teacher) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'L\'enseignant indiqué n\'existe pas pour cet établissement.');
      }
      if (branchId && teacher.branchId && teacher.branchId !== branchId) {
        throw new ApiError(422, 'CROSS_BRANCH_ASSIGNMENT', 'Cet enseignant appartient à un autre campus que cette classe.');
      }
    }

    const inserted = await db.transaction(async (tx) => {
      const [createdClass] = await tx.insert(classes).values({
        tenantId,
        branchId,
        name: body.name,
        includeSemesters: body.periodType ? body.periodType === 'semester' : body.includeSemesters,
        periodType: body.periodType ?? 'semester',
        mediumId: body.mediumId,
        shiftId: body.shiftId,
        streamId: body.streamId,
        cycle: body.cycle,
      }).returning();

      const count = body.sectionCount ?? 0;
      if (count > 0) {
        for (let index = 0; index < count; index += 1) {
          const suffix = String.fromCharCode(65 + index);
          // Reusable section label only (A, B, C...). The class name must not
          // bake the section in — "2nde A" belongs to the class-section pair.
          const sectionName = suffix;
          const [section] = await tx.insert(sections).values({ tenantId, name: sectionName }).onConflictDoUpdate({
            target: [sections.tenantId, sections.name],
            set: { name: sectionName },
          }).returning();
          const [classSection] = await tx.insert(classSections).values({ tenantId, classId: createdClass!.id, sectionId: section!.id, mediumId: body.mediumId }).returning();
          if (body.teacherId) {
            await tx.insert(classTeachers).values({ tenantId, classSectionId: classSection!.id, teacherId: body.teacherId, role: 'primary', assignedBy: context.userId });
          }
        }
      }
      return createdClass!;
    });

    recordAudit(context, 'create', 'class', inserted.id, { sectionCount: body.sectionCount ?? 0, teacherId: body.teacherId ?? null, branchId });

    return NextResponse.json({ success: true, data: toApiClass(inserted), branchUnassigned: branchId === null });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, classUpdateSchema);

    await assertSameTenantReferences(tenantId, body);

    const existing = await findClassInScope(context, tenantId, body.id, { purpose: 'write' });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    // Branch-limited admins cannot move a class; whole-school admins may
    // explicitly assign/repair a campus (validated against the tenant).
    let nextBranchId: string | null | undefined;
    if (body.branchId !== undefined) {
      if (context.branchId) {
        nextBranchId = context.branchId;
      } else {
        nextBranchId = await resolveWritableBranch(context, tenantId, body.branchId);
      }
    }

    const [updated] = await db
      .update(classes)
      .set({
        name: body.name,
        includeSemesters: body.includeSemesters,
        periodType: body.periodType,
        mediumId: body.mediumId,
        shiftId: body.shiftId,
        streamId: body.streamId,
        cycle: body.cycle,
        ...(nextBranchId !== undefined ? { branchId: nextBranchId } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(classes.id, body.id), eq(classes.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'class', body.id, {
      branchChanged: nextBranchId !== undefined && nextBranchId !== existing.branchId
        ? { from: existing.branchId, to: nextBranchId }
        : undefined,
    });

    return NextResponse.json({ success: true, data: toApiClass(updated) });
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

    const existing = await findClassInScope(context, tenantId, id, { purpose: 'write' });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    // Only a clean, never-used class may be hard-deleted. Any section —
    // even an empty one — is operational structure with a cascade path.
    const blockers = await classDependencyBlockers(tenantId, id);
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CLASS_IN_USE',
            message: 'Cette classe possède un historique scolaire et ne peut pas être supprimée.',
          },
          blockers,
        },
        { status: 409 },
      );
    }

    await db.delete(classes).where(and(eq(classes.id, id), eq(classes.tenantId, tenantId)));
    recordAudit(context, 'delete', 'class', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
