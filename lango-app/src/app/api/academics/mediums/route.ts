import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { mediumCreateSchema, mediumUpdateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { mediums } from '@/models/Schema';

function toApiMedium(row: typeof mediums.$inferSelect) {
  return { id: row.id, name: row.name, schoolId: row.tenantId };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(mediums.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(mediums).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(mediums).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiMedium),
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
    const body = await parseJson(request, mediumCreateSchema);

    const [inserted] = await db.insert(mediums).values({ tenantId, name: body.name }).returning();

    recordAudit(context, 'create', 'medium', inserted!.id);

    return NextResponse.json({ success: true, data: toApiMedium(inserted!) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, mediumUpdateSchema);

    const [updated] = await db
      .update(mediums)
      .set({ name: body.name })
      .where(and(eq(mediums.id, body.id), eq(mediums.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'medium', body.id);

    return NextResponse.json({ success: true, data: toApiMedium(updated) });
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

    await db.delete(mediums).where(and(eq(mediums.id, id), eq(mediums.tenantId, tenantId)));
    recordAudit(context, 'delete', 'medium', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
