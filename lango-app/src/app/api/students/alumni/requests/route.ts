import { and, count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { alumniRequests, user } from '@/models/Schema';

// Real staff review queue for all alumni request types (future-implementation
// /alumni-portal).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const status = searchParams.get('status');

    const conditions = [eq(alumniRequests.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(alumniRequests.status, status as 'received' | 'accepted' | 'preparing' | 'ready' | 'taken' | 'refused'));
    }
    const where = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      db
        .select({
          id: alumniRequests.id,
          alumnusId: alumniRequests.alumnusId,
          alumnusName: user.name,
          type: alumniRequests.type,
          status: alumniRequests.status,
          note: alumniRequests.note,
          relatedDocumentId: alumniRequests.relatedDocumentId,
          decisionNote: alumniRequests.decisionNote,
          decidedAt: alumniRequests.decidedAt,
          createdAt: alumniRequests.createdAt,
        })
        .from(alumniRequests)
        .innerJoin(user, eq(alumniRequests.alumnusId, user.id))
        .where(where)
        .orderBy(desc(alumniRequests.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(alumniRequests).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows,
      total: totalRows[0]?.total ?? 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
