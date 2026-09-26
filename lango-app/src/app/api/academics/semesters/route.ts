import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, semesterCreateSchema, semesterUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSubjects, semesters } from '@/models/Schema';

function toApiSemester(row: typeof semesters.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    startMonth: row.startMonth,
    endMonth: row.endMonth,
    schoolId: row.tenantId,
  };
}

/** SCF-10-01: audit metadata names the fields that actually moved. */
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

const AUDITED_SEMESTER_FIELDS = ['name', 'startMonth', 'endMonth'] as const;

export async function GET(request: Request) {
  try {
    // Listing terms is a read and belongs to academics.read; academics.manage
    // still gates the writes on this route. The cash desk needs term names and
    // used to get 403 here.
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant']);
    const tenantId = requireTenant(context);
    // Finance-scoped read for the accountant: term names are needed to post
    // payments and the role may hold finance powers without academics.read.
    if (context.role === 'accountant') {
      await requireCapability(context, 'finance.manage');
    } else {
      await requireCapability(context, 'academics.read');
    }
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
    await requireCapability(context, 'academics.manage');
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
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, semesterUpdateSchema);

    // Read the previous row in the same transaction as the update so the
    // audit's "before" is what was actually replaced.
    const result = await db.transaction(async (tx) => {
      const [previous] = await tx
        .select()
        .from(semesters)
        .where(and(eq(semesters.id, body.id), eq(semesters.tenantId, tenantId)))
        .for('update')
        .limit(1);
      const [row] = await tx
        .update(semesters)
        .set({ name: body.name, startMonth: body.startMonth, endMonth: body.endMonth })
        .where(and(eq(semesters.id, body.id), eq(semesters.tenantId, tenantId)))
        .returning();
      return { previous, row };
    });

    const { previous, row: updated } = result;

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    const changed = changedFields(previous ?? {}, updated, AUDITED_SEMESTER_FIELDS);
    recordAudit(
      context,
      'update',
      'semester',
      body.id,
      Object.keys(changed).length > 0 ? { changed } : undefined,
    );

    return NextResponse.json({ success: true, data: toApiSemester(updated) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * Reference safety: in the CURRENT exposed model, curriculum rows
 * (class_subjects.semesterId) are the authoritative period dependency.
 * Exam-term and reporting convergence is a separate tracked workstream and is
 * deliberately not claimed here.
 */
async function semesterDependencyBlockers(tenantId: string, semesterId: string) {
  const [classSubjectRows] = await Promise.all([
    db.select({ n: count() }).from(classSubjects).where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.semesterId, semesterId))),
  ]);

  return [
    { key: 'class_subjects', count: Number(classSubjectRows[0]?.n ?? 0) },
  ].filter(blocker => blocker.count > 0);
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

    const [existing] = await db.select().from(semesters).where(and(eq(semesters.id, id), eq(semesters.tenantId, tenantId))).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    const blockers = await semesterDependencyBlockers(tenantId, id);
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SEMESTER_IN_USE',
            message: 'Cette période est référencée par le curriculum actif et ne peut pas être supprimée.',
          },
          blockers,
        },
        { status: 409 },
      );
    }

    await db.delete(semesters).where(and(eq(semesters.id, id), eq(semesters.tenantId, tenantId)));
    recordAudit(context, 'delete', 'semester', id, {
      changed: changedFields(existing, {}, AUDITED_SEMESTER_FIELDS),
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
