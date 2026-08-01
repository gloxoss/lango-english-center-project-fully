import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson, shiftCreateSchema, shiftUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { shifts } from '@/models/Schema';

function toApiShift(row: typeof shifts.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    startTime: row.startTime,
    endTime: row.endTime,
    isActive: row.isActive,
    schoolId: row.tenantId,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(shifts.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(shifts).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(shifts).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiShift),
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
    const body = await parseJson(request, shiftCreateSchema);

    const [inserted] = await db
      .insert(shifts)
      .values({
        tenantId,
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        isActive: body.isActive,
      })
      .returning();

    recordAudit(context, 'create', 'shift', inserted!.id);

    return NextResponse.json({ success: true, data: toApiShift(inserted!) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, shiftUpdateSchema);

    const [updated] = await db
      .update(shifts)
      .set({
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        isActive: body.isActive,
      })
      .where(and(eq(shifts.id, body.id), eq(shifts.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'shift', body.id);

    return NextResponse.json({ success: true, data: toApiShift(updated) });
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

    await db.delete(shifts).where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)));
    recordAudit(context, 'delete', 'shift', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
