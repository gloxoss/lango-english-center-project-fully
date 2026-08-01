import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson, subjectCreateSchema, subjectUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { mediums, subjects } from '@/models/Schema';

function toApiSubject(row: typeof subjects.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    mediumId: row.mediumId,
    type: row.type,
    schoolId: row.tenantId,
  };
}

async function assertMediumBelongsToTenant(tenantId: string, mediumId: string) {
  const [row] = await db.select({ id: mediums.id }).from(mediums).where(and(eq(mediums.id, mediumId), eq(mediums.tenantId, tenantId))).limit(1);
  if (!row) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'Le modèle linguistique indiqué n\'existe pas pour cet établissement.');
  }
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(subjects.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(subjects).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(subjects).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiSubject),
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
    const body = await parseJson(request, subjectCreateSchema);

    await assertMediumBelongsToTenant(tenantId, body.mediumId);

    const [inserted] = await db
      .insert(subjects)
      .values({ tenantId, name: body.name, code: body.code, mediumId: body.mediumId, type: body.type })
      .returning();

    recordAudit(context, 'create', 'subject', inserted!.id);

    return NextResponse.json({ success: true, data: toApiSubject(inserted!) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, subjectUpdateSchema);

    if (body.mediumId) {
      await assertMediumBelongsToTenant(tenantId, body.mediumId);
    }

    const [updated] = await db
      .update(subjects)
      .set({
        name: body.name,
        code: body.code,
        mediumId: body.mediumId,
        type: body.type,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(subjects.id, body.id), eq(subjects.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'subject', body.id);

    return NextResponse.json({ success: true, data: toApiSubject(updated) });
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

    await db.delete(subjects).where(and(eq(subjects.id, id), eq(subjects.tenantId, tenantId)));
    recordAudit(context, 'delete', 'subject', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
