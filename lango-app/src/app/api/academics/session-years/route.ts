import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, sessionYearCreateSchema, sessionYearUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { sessionYears } from '@/models/Schema';

function toApiSessionYear(row: typeof sessionYears.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    isDefault: row.isDefault,
    schoolId: row.tenantId,
  };
}

// Only one session year can be the tenant's default at a time - setting a new
// one unsets the rest in the same transaction (see POST/PUT below), rather than
// leaving two "default" rows for the UI to disagree about.

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(sessionYears.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(sessionYears).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(sessionYears).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiSessionYear),
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
    const body = await parseJson(request, sessionYearCreateSchema);

    const inserted = await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx.update(sessionYears).set({ isDefault: false }).where(eq(sessionYears.tenantId, tenantId));
      }
      const [row] = await tx
        .insert(sessionYears)
        .values({
          tenantId,
          name: body.name,
          startDate: body.startDate,
          endDate: body.endDate,
          isDefault: body.isDefault,
        })
        .returning();
      return row;
    });

    recordAudit(context, 'create', 'session_year', inserted!.id);

    return NextResponse.json({ success: true, data: toApiSessionYear(inserted!) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, sessionYearUpdateSchema);

    const updated = await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx.update(sessionYears).set({ isDefault: false }).where(eq(sessionYears.tenantId, tenantId));
      }
      const [row] = await tx
        .update(sessionYears)
        .set({
          name: body.name,
          startDate: body.startDate,
          endDate: body.endDate,
          isDefault: body.isDefault,
        })
        .where(and(eq(sessionYears.id, body.id), eq(sessionYears.tenantId, tenantId)))
        .returning();
      return row;
    });

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'session_year', body.id);

    return NextResponse.json({ success: true, data: toApiSessionYear(updated) });
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

    await db.delete(sessionYears).where(and(eq(sessionYears.id, id), eq(sessionYears.tenantId, tenantId)));
    recordAudit(context, 'delete', 'session_year', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
