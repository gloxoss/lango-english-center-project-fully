import { and, asc, count, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { CYCLE_LABELS } from '@/features/academics/services/filiere-structure';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, streamCreateSchema, streamUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { streams } from '@/models/Schema';

function toApiStream(row: typeof streams.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    cycle: row.cycle,
    cycleLabel: row.cycle ? CYCLE_LABELS[row.cycle] : null,
    bacSeriesCode: row.bacSeriesCode,
    isActive: row.isActive,
    displayOrder: row.displayOrder,
    schoolId: row.tenantId,
  };
}

/** Empty string is how a cleared form field arrives; store it as NULL. */
function nullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * Codes are optional but unique per school, so a duplicate has to be caught
 * before the insert rather than surfacing as a raw constraint violation.
 */
async function assertCodeFree(tenantId: string, code: string | null, excludeId?: string) {
  if (!code) {
    return;
  }

  const conditions = [eq(streams.tenantId, tenantId), eq(streams.code, code)];
  if (excludeId) {
    conditions.push(ne(streams.id, excludeId));
  }

  const [existing] = await db.select({ id: streams.id }).from(streams).where(and(...conditions)).limit(1);
  if (existing) {
    throw new ApiError(409, 'ALREADY_EXISTS', 'Une filière avec ce code existe déjà dans cet établissement.');
  }
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(streams.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(streams).where(where).orderBy(asc(streams.displayOrder), asc(streams.name)).limit(pagination.limit).offset(pagination.offset),
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
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, streamCreateSchema);
    const code = nullableText(body.code) ?? null;
    await assertCodeFree(tenantId, code);

    const [inserted] = await db.insert(streams).values({
      tenantId,
      name: body.name,
      code,
      cycle: body.cycle ?? null,
      bacSeriesCode: nullableText(body.bacSeriesCode) ?? null,
      isActive: body.isActive ?? true,
      displayOrder: body.displayOrder ?? 0,
    }).returning();

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
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, streamUpdateSchema);

    const [existing] = await db.select().from(streams).where(and(eq(streams.id, body.id), eq(streams.tenantId, tenantId))).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    const nextCode = nullableText(body.code);
    if (nextCode !== undefined && nextCode !== existing.code) {
      await assertCodeFree(tenantId, nextCode, body.id);
    }

    const [updated] = await db
      .update(streams)
      .set({
        name: body.name ?? existing.name,
        code: nextCode !== undefined ? nextCode : existing.code,
        cycle: body.cycle !== undefined ? body.cycle : existing.cycle,
        bacSeriesCode: body.bacSeriesCode !== undefined ? nullableText(body.bacSeriesCode) ?? null : existing.bacSeriesCode,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
        displayOrder: body.displayOrder !== undefined ? body.displayOrder : existing.displayOrder,
        updatedAt: new Date().toISOString(),
      })
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
    await requireCapability(context, 'academics.manage');
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
