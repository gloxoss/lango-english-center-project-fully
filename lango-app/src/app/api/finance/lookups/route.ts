import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { classes, classSections, sections, semesters } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');
    const params = new URL(request.url).searchParams;
    const resource = params.get('resource');
    if (resource !== 'class-sections' && resource !== 'semesters') {
      throw new ApiError(400, 'INVALID_QUERY', 'Liste de référence inconnue.');
    }
    const pagination = parsePagination(params);

    if (resource === 'semesters') {
      const where = eq(semesters.tenantId, tenantId);
      const [rows, totals] = await Promise.all([
        db.select({ id: semesters.id, name: semesters.name })
          .from(semesters).where(where).orderBy(semesters.name)
          .limit(pagination.limit).offset(pagination.offset),
        db.select({ total: count() }).from(semesters).where(where),
      ]);
      return NextResponse.json({ success: true, data: rows, total: totals[0]?.total ?? 0, page: pagination.page, pageSize: pagination.pageSize });
    }

    const where = and(
      eq(classSections.tenantId, tenantId),
      eq(classes.tenantId, tenantId),
      eq(sections.tenantId, tenantId),
      context.branchId ? eq(classes.branchId, context.branchId) : undefined,
    );
    const [rows, totals] = await Promise.all([
      db.select({ id: classSections.id, className: classes.name, sectionName: sections.name })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .where(where).orderBy(classes.name, sections.name)
        .limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .where(where),
    ]);
    return NextResponse.json({ success: true, data: rows, total: totals[0]?.total ?? 0, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
