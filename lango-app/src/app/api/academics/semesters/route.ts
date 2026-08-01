import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson, semesterCreateSchema, semesterUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { semesters } from '@/models/Schema';

function toApiSemester(row: typeof semesters.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    startMonth: row.startMonth,
    endMonth: row.endMonth,
    schoolId: row.tenantId,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(semesters.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(semesters).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(semesters).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiSemester),
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
    const body = await parseJson(request, semesterCreateSchema);

    const [inserted] = await db
      .insert(semesters)
      .values({ tenantId, name: body.name, startMonth: body.startMonth, endMonth: body.endMonth })
      .returning();

    recordAudit(context, 'create', 'semester', inserted!.id);

    return NextResponse.json({ success: true, data: toApiSemester(inserted!) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, semesterUpdateSchema);

    const [updated] = await db
      .update(semesters)
      .set({ name: body.name, startMonth: body.startMonth, endMonth: body.endMonth })
      .where(and(eq(semesters.id, body.id), eq(semesters.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'semester', body.id);

    return NextResponse.json({ success: true, data: toApiSemester(updated) });
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

    await db.delete(semesters).where(and(eq(semesters.id, id), eq(semesters.tenantId, tenantId)));
    recordAudit(context, 'delete', 'semester', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
