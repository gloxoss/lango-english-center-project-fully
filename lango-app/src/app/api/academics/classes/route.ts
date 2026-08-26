import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { classCreateSchema, classUpdateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classes, classSections, classTeachers, mediums, sections, shifts, streams, user } from '@/models/Schema';

function toApiClass(row: typeof classes.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    includeSemesters: row.includeSemesters,
    periodType: row.periodType,
    mediumId: row.mediumId,
    shiftId: row.shiftId,
    streamId: row.streamId,
    cycle: row.cycle,
    schoolId: row.tenantId,
  };
}

// A client-sent mediumId/shiftId/streamId belonging to a different tenant must
// never silently succeed (it would let tenant A read/link tenant B's reference
// data) or leak a raw FK-violation error - reject it explicitly, up front.
async function assertSameTenantReferences(tenantId: string, refs: { mediumId?: string; shiftId?: string | null; streamId?: string | null }) {
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
    const [row] = await db.select({ id: streams.id }).from(streams).where(and(eq(streams.id, refs.streamId), eq(streams.tenantId, tenantId))).limit(1);
    if (!row) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La filière indiquée n\'existe pas pour cet établissement.');
    }
  }
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
    const conditions = [eq(classes.tenantId, tenantId)];
    if (context.branchId) {
      conditions.push(eq(classes.branchId, context.branchId));
    }
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [rows, totalRows] = await Promise.all([
      db.select().from(classes).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(classes).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiClass),
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
    const body = await parseJson(request, classCreateSchema);

    await assertSameTenantReferences(tenantId, body);

    if (body.teacherId) {
      const [teacher] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, body.teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher'))).limit(1);
      if (!teacher) throw new ApiError(422, 'INVALID_REFERENCE', 'L\'enseignant indiqué n\'existe pas pour cet établissement.');
    }

    const inserted = await db.transaction(async (tx) => {
      const [createdClass] = await tx.insert(classes).values({
        tenantId,
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
          const sectionName = `${body.name} - ${suffix}`;
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

    recordAudit(context, 'create', 'class', inserted.id, { sectionCount: body.sectionCount ?? 0, teacherId: body.teacherId ?? null });

    return NextResponse.json({ success: true, data: toApiClass(inserted) });
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
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(classes.id, body.id), eq(classes.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'class', body.id);

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

    await db.delete(classes).where(and(eq(classes.id, id), eq(classes.tenantId, tenantId)));
    recordAudit(context, 'delete', 'class', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
