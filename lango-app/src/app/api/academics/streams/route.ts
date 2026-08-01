import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson, streamCreateSchema, streamUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { streams } from '@/models/Schema';

function toApiStream(row: typeof streams.$inferSelect) {
  return { id: row.id, name: row.name, schoolId: row.tenantId };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(streams.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(streams).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(streams).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiStream),
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
    const body = await parseJson(request, streamCreateSchema);

    const [inserted] = await db.insert(streams).values({ tenantId, name: body.name }).returning();

    recordAudit(context, 'create', 'stream', inserted!.id);

    return NextResponse.json({ success: true, data: toApiStream(inserted!) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, streamUpdateSchema);

    const [updated] = await db
      .update(streams)
      .set({ name: body.name })
      .where(and(eq(streams.id, body.id), eq(streams.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'stream', body.id);

    return NextResponse.json({ success: true, data: toApiStream(updated) });
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

    await db.delete(streams).where(and(eq(streams.id, id), eq(streams.tenantId, tenantId)));
    recordAudit(context, 'delete', 'stream', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
