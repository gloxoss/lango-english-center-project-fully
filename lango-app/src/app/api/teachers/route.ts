import { and, count, eq, ilike, inArray, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, teacherCreateSchema, teacherUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classes, classSections, classTeachers, sections, subjects, subjectTeachers, user } from '@/models/Schema';
import { toDbStatus, toUiStatus } from '@/models/userMapping';

// ponytail: teachers are `user` rows with role = 'teacher'. employeeId,
// specialization, cycle, workloadHours, hireDate, documents are stopgap columns -
// see MIGRATION-NOTES.md. subjects/assignedClasses are DEPRECATED stopgaps,
// superseded by the real classTeachers/subjectTeachers join tables; still read
// as a fallback for teachers with no rows in those tables yet.

// Batch-loads real assignments for a page of teachers in two queries total,
// rather than one query per teacher.
async function loadAssignedClassNames(teacherIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (teacherIds.length === 0) {
    return map;
  }
  const rows = await db
    .select({ teacherId: classTeachers.teacherId, className: classes.name, sectionName: sections.name })
    .from(classTeachers)
    .innerJoin(classSections, eq(classTeachers.classSectionId, classSections.id))
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .where(inArray(classTeachers.teacherId, teacherIds));

  for (const row of rows) {
    const names = map.get(row.teacherId) ?? [];
    names.push(`${row.className} ${row.sectionName}`.trim());
    map.set(row.teacherId, names);
  }
  return map;
}

async function loadTaughtSubjectNames(teacherIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (teacherIds.length === 0) {
    return map;
  }
  const rows = await db
    .select({ teacherId: subjectTeachers.teacherId, subjectName: subjects.name })
    .from(subjectTeachers)
    .innerJoin(subjects, eq(subjectTeachers.subjectId, subjects.id))
    .where(inArray(subjectTeachers.teacherId, teacherIds));

  for (const row of rows) {
    const names = map.get(row.teacherId) ?? [];
    if (!names.includes(row.subjectName)) {
      names.push(row.subjectName);
    }
    map.set(row.teacherId, names);
  }
  return map;
}

function toApiTeacher(row: typeof user.$inferSelect, assignedClasses: string[], taughtSubjects: string[]) {
  return {
    id: row.id,
    employeeId: row.employeeId ?? '',
    name: row.name,
    email: row.email,
    phone: row.phone ?? '',
    specialization: row.specialization ?? '',
    subjects: taughtSubjects.length > 0 ? taughtSubjects : (row.subjects ?? []),
    cycle: row.cycle ?? '',
    assignedClasses: assignedClasses.length > 0 ? assignedClasses : (row.assignedClasses ?? []),
    status: toUiStatus(row.userStatus),
    workloadHours: row.workloadHours ?? 0,
    avatarUrl: row.photoUrl ? `/api/teachers/photo?id=${row.id}` : undefined,
    hireDate: row.hireDate ?? undefined,
    documents: row.documents ?? { contract: false, cin: false, diploma: false },
  };
}

function generateEmployeeId(): string {
  const year = new Date().getFullYear();
  return `ENS-${year}-${Math.floor(100 + Math.random() * 900)}`;
}

// Single-teacher detail fetch (dashboard/teachers/:id profile page) - `?id=`
// matches the query-param-detail convention already used by
// /api/students?id= and DELETE below, rather than a new [id] route style.
async function getTeacherDetail(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(user)
    .where(and(eq(user.id, id), eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
    .limit(1);

  if (!row) {
    return null;
  }

  const assignmentRows = await db
    .select({ classSectionId: classTeachers.classSectionId, className: classes.name, sectionName: sections.name })
    .from(classTeachers)
    .innerJoin(classSections, eq(classTeachers.classSectionId, classSections.id))
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .where(eq(classTeachers.teacherId, id));

  const classSectionIds = assignmentRows.map(a => a.classSectionId);
  const studentCounts = new Map<string, number>();
  if (classSectionIds.length > 0) {
    const countRows = await db
      .select({ classSectionId: user.classSectionId, count: count() })
      .from(user)
      .where(and(eq(user.role, 'student'), eq(user.tenantId, tenantId), inArray(user.classSectionId, classSectionIds)))
      .groupBy(user.classSectionId);
    for (const c of countRows) {
      if (c.classSectionId) {
        studentCounts.set(c.classSectionId, c.count);
      }
    }
  }

  const [taughtSubjects] = await Promise.all([loadTaughtSubjectNames([id])]);

  return {
    ...toApiTeacher(row, assignmentRows.map(a => `${a.className} ${a.sectionName}`.trim()), taughtSubjects.get(id) ?? []),
    firstName: row.firstName,
    lastName: row.lastName,
    createdAt: row.createdAt,
    assignedClassDetails: assignmentRows.map(a => ({
      classSectionId: a.classSectionId,
      label: `${a.className} ${a.sectionName}`.trim(),
      studentCount: studentCounts.get(a.classSectionId) ?? 0,
    })),
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);

    const id = searchParams.get('id');
    if (id) {
      const detail = await getTeacherDetail(tenantId, id);
      if (!detail) {
        return NextResponse.json({ success: false, message: 'Enseignant non trouvé' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');

    const filters = [
      eq(user.role, 'teacher'),
      eq(user.tenantId, tenantId),
    ];

    if (search) {
      const term = `%${search}%`;
      filters.push(
        or(
          ilike(user.name, term),
          ilike(user.employeeId, term),
          ilike(user.specialization, term),
        )!,
      );
    }

    if (status && status !== 'Tous' && status !== 'all') {
      filters.push(eq(user.userStatus, toDbStatus(status)));
    }

    const pagination = parsePagination(searchParams);
    const where = and(...filters);

    const [rows, totalRows] = await Promise.all([
      db.select().from(user).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(user).where(where),
    ]);
    const total = totalRows[0]?.total ?? 0;

    const teacherIds = rows.map(r => r.id);
    const [classesByTeacher, subjectsByTeacher] = await Promise.all([
      loadAssignedClassNames(teacherIds),
      loadTaughtSubjectNames(teacherIds),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(row => toApiTeacher(row, classesByTeacher.get(row.id) ?? [], subjectsByTeacher.get(row.id) ?? [])),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.create');
    const body = await parseJson(request, teacherCreateSchema);
    const id = `TCH-${Date.now()}`;

    const [inserted] = await db
      .insert(user)
      .values({
        id,
        tenantId,
        name: body.fullName,
        email: body.email || `${id.toLowerCase()}@schoolos.ma`,
        phone: body.phone,
        role: 'teacher',
        employeeId: body.employeeId || generateEmployeeId(),
        specialization: body.specialization,
        cycle: body.cycle,
        workloadHours: body.workloadHours,
        hireDate: body.hireDate,
        userStatus: toDbStatus(body.status),
        documents: body.documents,
      })
      .returning();

    recordAudit(context, 'create', 'teacher', inserted!.id);

    return NextResponse.json({
      success: true,
      data: toApiTeacher(inserted!, [], []),
      message: 'Enseignant créé avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.update');
    const body = await parseJson(request, teacherUpdateSchema);

    const [updated] = await db
      .update(user)
      .set({
        name: body.fullName,
        phone: body.phone,
        specialization: body.specialization,
        cycle: body.cycle,
        workloadHours: body.workloadHours,
        hireDate: body.hireDate,
        userStatus: body.status ? toDbStatus(body.status) : undefined,
        documents: body.documents,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(user.id, body.id), eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Enseignant non trouvé' }, { status: 404 });
    }

    recordAudit(context, 'update', 'teacher', body.id);

    const [classesByTeacher, subjectsByTeacher] = await Promise.all([
      loadAssignedClassNames([updated.id]),
      loadTaughtSubjectNames([updated.id]),
    ]);

    return NextResponse.json({
      success: true,
      data: toApiTeacher(updated, classesByTeacher.get(updated.id) ?? [], subjectsByTeacher.get(updated.id) ?? []),
      message: 'Enseignant mis à jour avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.delete');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await db.delete(user).where(and(eq(user.id, id), eq(user.tenantId, tenantId), eq(user.role, 'teacher')));
      recordAudit(context, 'delete', 'teacher', id);
      return NextResponse.json({
        success: true,
        message: 'Enseignant supprimé avec succès',
        id,
      });
    }

    return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
