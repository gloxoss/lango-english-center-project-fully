import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, sectionCreateSchema, sectionUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { sections } from '@/models/Schema';

function toApiSection(row: typeof sections.$inferSelect) {
  return { id: row.id, name: row.name, schoolId: row.tenantId };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(sections.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(sections).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(sections).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiSection),
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
    const body = await parseJson(request, sectionCreateSchema);

    const [inserted] = await db.insert(sections).values({ tenantId, name: body.name }).returning();

    recordAudit(context, 'create', 'section', inserted!.id);

    return NextResponse.json({ success: true, data: toApiSection(inserted!) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, sectionUpdateSchema);

    const [updated] = await db
      .update(sections)
      .set({ name: body.name })
      .where(and(eq(sections.id, body.id), eq(sections.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'section', body.id);

    return NextResponse.json({ success: true, data: toApiSection(updated) });
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

    await db.delete(sections).where(and(eq(sections.id, id), eq(sections.tenantId, tenantId)));
    recordAudit(context, 'delete', 'section', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
