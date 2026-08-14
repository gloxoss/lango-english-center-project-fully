import { and, count, desc, eq, ilike } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { alumniDirectoryConsent, sessionYears, user } from '@/models/Schema';

// Real staff-side alumni list (future-implementation/alumni-portal),
// replacing the removed fake portals/alumni page.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const search = searchParams.get('search');

    const conditions = [eq(user.tenantId, tenantId), eq(user.role, 'alumni')];
    if (search) {
      conditions.push(ilike(user.name, `%${search}%`));
    }
    const where = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          alumniTransitionedAt: user.alumniTransitionedAt,
          cohortName: sessionYears.name,
          showName: alumniDirectoryConsent.showName,
        })
        .from(user)
        .leftJoin(sessionYears, eq(user.graduationCohortSessionYearId, sessionYears.id))
        .leftJoin(alumniDirectoryConsent, eq(alumniDirectoryConsent.alumnusId, user.id))
        .where(where)
        .orderBy(desc(user.alumniTransitionedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(user).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({ ...r, directoryOptIn: !!r.showName })),
      total: totalRows[0]?.total ?? 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
