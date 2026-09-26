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

/**
 * SCF-10-01: audit metadata names the fields that actually moved. The audit
 * trail used to say "a year was updated" without saying what changed, which is
 * useless for a date that shifts a school year or a flag that moves the whole
 * app to another year. Unchanged fields are omitted so the row stays readable.
 */
function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): Record<string, { before: unknown; after: unknown }> {
  const changed: Record<string, { before: unknown; after: unknown }> = {};
  for (const field of fields) {
    const previous = before[field] ?? null;
    const next = after[field] ?? null;
    if (previous !== next) {
      changed[field] = { before: previous, after: next };
    }
  }
  return changed;
}

const AUDITED_YEAR_FIELDS = ['name', 'startDate', 'endDate', 'isDefault'] as const;

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

    // Read inside the transaction so the "before" is the row the update
    // actually replaced, not a stale read racing another writer.
    const result = await db.transaction(async (tx) => {
      const [previous] = await tx
        .select()
        .from(sessionYears)
        .where(and(eq(sessionYears.id, body.id), eq(sessionYears.tenantId, tenantId)))
        .for('update')
        .limit(1);

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
      return { previous, row };
    });

    const { previous, row: updated } = result;

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    const changed = changedFields(previous ?? {}, updated, AUDITED_YEAR_FIELDS);
    recordAudit(
      context,
      'update',
      'session_year',
      body.id,
      Object.keys(changed).length > 0 ? { changed } : undefined,
    );

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

    const deleted = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(sessionYears)
        .where(and(eq(sessionYears.id, id), eq(sessionYears.tenantId, tenantId)))
        .for('update')
        .limit(1);
      if (!row) return null;
      await tx.delete(sessionYears).where(and(eq(sessionYears.id, id), eq(sessionYears.tenantId, tenantId)));
      return row;
    });

    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'delete', 'session_year', id, {
      changed: changedFields(deleted, {}, AUDITED_YEAR_FIELDS),
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
