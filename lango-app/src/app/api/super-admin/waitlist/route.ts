import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson, waitlistUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { schoolAccessRequests } from '@/models/Schema';

const WAITLIST_STATUSES = ['new', 'contacted', 'converted', 'dismissed'] as const;

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    requireSuperAdmin(context);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const q = searchParams.get('q')?.trim();

    const conditions = [];
    if (status && (WAITLIST_STATUSES as readonly string[]).includes(status)) {
      conditions.push(eq(schoolAccessRequests.status, status));
    }
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(
        ilike(schoolAccessRequests.schoolName, pattern),
        ilike(schoolAccessRequests.contactName, pattern),
        ilike(schoolAccessRequests.city, pattern),
      ));
    }

    const rows = await db
      .select()
      .from(schoolAccessRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schoolAccessRequests.createdAt));

    const [counts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        new: sql<number>`count(*) FILTER (WHERE status = 'new')::int`,
        contacted: sql<number>`count(*) FILTER (WHERE status = 'contacted')::int`,
        converted: sql<number>`count(*) FILTER (WHERE status = 'converted')::int`,
      })
      .from(schoolAccessRequests);

    return NextResponse.json({ success: true, data: rows, counts: counts ?? null });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    requireSuperAdmin(context);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    const body = await parseJson(request, waitlistUpdateSchema);

    const [updated] = await db
      .update(schoolAccessRequests)
      .set({
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schoolAccessRequests.id, id))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'NOT_FOUND', 'Demande introuvable');
    }

    recordAudit(context, 'update', 'school_access_request', id, { status: body.status });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
