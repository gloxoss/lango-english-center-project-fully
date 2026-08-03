import { and, count, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { classSectionCreateSchema, classSectionUpdateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classes, classSections, sections } from '@/models/Schema';

function toApiClassSection(row: typeof classSections.$inferSelect) {
  return {
    id: row.id,
    classId: row.classId,
    sectionId: row.sectionId,
    mediumId: row.mediumId,
    schoolId: row.tenantId,
  };
}

// mediumId is never accepted from the client - it is always derived from the
// class, matching ESchool's denormalization intent (class_sections.medium_id
// always mirrors classes.medium_id). Also confirms classId/sectionId belong to
// this tenant before the insert/update is attempted.
async function resolveMediumId(tenantId: string, classId: string, sectionId: string): Promise<string> {
  const [classRow] = await db.select({ mediumId: classes.mediumId }).from(classes).where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId))).limit(1);
  if (!classRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La classe indiquée n\'existe pas pour cet établissement.');
  }
  const [sectionRow] = await db.select({ id: sections.id }).from(sections).where(and(eq(sections.id, sectionId), eq(sections.tenantId, tenantId))).limit(1);
  if (!sectionRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La section indiquée n\'existe pas pour cet établissement.');
  }
  return classRow.mediumId;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const conditions = [eq(classSections.tenantId, tenantId)];
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
          sectionName: sections.name,
        })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .where(where)
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(classSections).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({ ...toApiClassSection(r.classSection), className: r.className, sectionName: r.sectionName })),
      total: totalRows[0]?.total ?? 0,
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
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, classSectionCreateSchema);

    const mediumId = await resolveMediumId(tenantId, body.classId, body.sectionId);

    const [inserted] = await db
      .insert(classSections)
      .values({ tenantId, classId: body.classId, sectionId: body.sectionId, mediumId })
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

    const set: { classId?: string; sectionId?: string; mediumId?: string; updatedAt: string } = {
      updatedAt: new Date().toISOString(),
    };
    if (body.classId || body.sectionId) {
      const [existing] = await db.select().from(classSections).where(and(eq(classSections.id, body.id), eq(classSections.tenantId, tenantId))).limit(1);
      if (!existing) {
        return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
      }
      const classId = body.classId ?? existing.classId;
      const sectionId = body.sectionId ?? existing.sectionId;
      set.mediumId = await resolveMediumId(tenantId, classId, sectionId);
      set.classId = classId;
      set.sectionId = sectionId;
    }

    const [updated] = await db
      .update(classSections)
      .set(set)
      .where(and(eq(classSections.id, body.id), eq(classSections.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'class_section', body.id);

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

    await db.delete(classSections).where(and(eq(classSections.id, id), eq(classSections.tenantId, tenantId)));
    recordAudit(context, 'delete', 'class_section', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
