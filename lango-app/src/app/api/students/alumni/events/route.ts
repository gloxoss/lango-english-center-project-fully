import { and, count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { alumniEventRsvps, alumniEvents } from '@/models/Schema';

const createEventSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  location: z.string().trim().max(255).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
}).strict();

const updateEventSchema = createEventSchema.partial().extend({ id: z.string().uuid() }).strict();

// Real, self-contained alumni events (future-implementation/alumni-portal) -
// not blocked on the separate unbuilt event-management addon.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const [rows, totalRows] = await Promise.all([
      db.select().from(alumniEvents).where(eq(alumniEvents.tenantId, tenantId)).orderBy(desc(alumniEvents.startsAt)).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(alumniEvents).where(eq(alumniEvents.tenantId, tenantId)),
    ]);

    // Batched RSVP counts per event/status, not N+1.
    const eventIds = rows.map(r => r.id);
    const rsvpCounts = eventIds.length > 0
      ? await db.select({ eventId: alumniEventRsvps.eventId, status: alumniEventRsvps.status, count: count() })
          .from(alumniEventRsvps)
          .where(eq(alumniEventRsvps.tenantId, tenantId))
          .groupBy(alumniEventRsvps.eventId, alumniEventRsvps.status)
      : [];
    const countsByEvent = new Map<string, Record<string, number>>();
    for (const r of rsvpCounts) {
      if (!eventIds.includes(r.eventId)) continue;
      const existing = countsByEvent.get(r.eventId) ?? {};
      existing[r.status] = r.count;
      countsByEvent.set(r.eventId, existing);
    }

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({ ...r, rsvpCounts: countsByEvent.get(r.id) ?? {} })),
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
    await requireCapability(context, 'admissions.manage');
    const body = await parseJson(request, createEventSchema);

    const [inserted] = await db.insert(alumniEvents).values({ tenantId, ...body, createdBy: context.userId }).returning();
    recordAudit(context, 'create', 'alumni_event', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: 'Événement créé avec succès' }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const body = await parseJson(request, updateEventSchema);
    const { id, ...fields } = body;

    const [updated] = await db.update(alumniEvents).set(fields).where(and(eq(alumniEvents.id, id), eq(alumniEvents.tenantId, tenantId))).returning();
    if (!updated) {
      throw new ApiError(404, 'NOT_FOUND', 'Événement introuvable.');
    }
    recordAudit(context, 'update', 'alumni_event', id);

    return NextResponse.json({ success: true, data: updated, message: 'Événement mis à jour' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    await db.delete(alumniEvents).where(and(eq(alumniEvents.id, id), eq(alumniEvents.tenantId, tenantId)));
    recordAudit(context, 'delete', 'alumni_event', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
