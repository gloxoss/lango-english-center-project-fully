import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { alumniEventRsvps, alumniEvents, branches, sessionYears, user } from '@/models/Schema';

const createEventSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  isPublished: z.boolean().optional().default(true),
  capacity: z.number().int().min(1).max(100000).optional().nullable(),
  targetCohortSessionYearId: z.string().uuid().optional().nullable(),
  targetBranchId: z.string().uuid().optional().nullable(),
  attachmentUrl: z.string().trim().max(500).optional().nullable(),
}).strict();

const updateEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
  capacity: z.number().int().min(1).max(100000).optional().nullable(),
  targetCohortSessionYearId: z.string().uuid().optional().nullable(),
  targetBranchId: z.string().uuid().optional().nullable(),
  attachmentUrl: z.string().trim().max(500).optional().nullable(),
  isCancelled: z.boolean().optional(),
  cancellationReason: z.string().trim().max(1000).optional().nullable(),
}).strict();

const checkInSchema = z.object({
  action: z.literal('check_in'),
  eventId: z.string().uuid(),
  alumnusId: z.string().min(1),
  checkedIn: z.boolean(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const { searchParams } = new URL(request.url);

    // Detail query: fetch single event with full attendees list and check-in status
    const eventIdParam = searchParams.get('eventId');
    if (eventIdParam) {
      const [singleEvent] = await db
        .select({
          id: alumniEvents.id,
          tenantId: alumniEvents.tenantId,
          title: alumniEvents.title,
          description: alumniEvents.description,
          location: alumniEvents.location,
          startsAt: alumniEvents.startsAt,
          endsAt: alumniEvents.endsAt,
          isPublished: alumniEvents.isPublished,
          capacity: alumniEvents.capacity,
          targetCohortSessionYearId: alumniEvents.targetCohortSessionYearId,
          targetCohortName: sessionYears.name,
          targetBranchId: alumniEvents.targetBranchId,
          targetBranchName: branches.name,
          attachmentUrl: alumniEvents.attachmentUrl,
          isCancelled: alumniEvents.isCancelled,
          cancellationReason: alumniEvents.cancellationReason,
          createdBy: alumniEvents.createdBy,
          createdAt: alumniEvents.createdAt,
        })
        .from(alumniEvents)
        .leftJoin(sessionYears, eq(alumniEvents.targetCohortSessionYearId, sessionYears.id))
        .leftJoin(branches, eq(alumniEvents.targetBranchId, branches.id))
        .where(and(eq(alumniEvents.id, eventIdParam), eq(alumniEvents.tenantId, tenantId)))
        .limit(1);

      if (!singleEvent) {
        throw new ApiError(404, 'NOT_FOUND', 'Événement introuvable.');
      }

      // Attendees roster
      const attendees = await db
        .select({
          rsvpId: alumniEventRsvps.id,
          alumnusId: alumniEventRsvps.alumnusId,
          alumnusName: user.name,
          alumnusEmail: user.email,
          alumnusPhone: user.phone,
          status: alumniEventRsvps.status,
          isWaitlisted: alumniEventRsvps.isWaitlisted,
          waitlistPosition: alumniEventRsvps.waitlistPosition,
          checkedIn: alumniEventRsvps.checkedIn,
          checkedInAt: alumniEventRsvps.checkedInAt,
          updatedAt: alumniEventRsvps.updatedAt,
        })
        .from(alumniEventRsvps)
        .innerJoin(user, eq(alumniEventRsvps.alumnusId, user.id))
        .where(and(eq(alumniEventRsvps.eventId, eventIdParam), eq(alumniEventRsvps.tenantId, tenantId)))
        .orderBy(desc(alumniEventRsvps.checkedIn), alumniEventRsvps.isWaitlisted, alumniEventRsvps.waitlistPosition);

      return NextResponse.json({
        success: true,
        data: {
          ...singleEvent,
          attendees,
        },
      });
    }

    const pagination = parsePagination(searchParams);

    const [rows, totalRows] = await Promise.all([
      db
        .select({
          id: alumniEvents.id,
          tenantId: alumniEvents.tenantId,
          title: alumniEvents.title,
          description: alumniEvents.description,
          location: alumniEvents.location,
          startsAt: alumniEvents.startsAt,
          endsAt: alumniEvents.endsAt,
          isPublished: alumniEvents.isPublished,
          capacity: alumniEvents.capacity,
          targetCohortSessionYearId: alumniEvents.targetCohortSessionYearId,
          targetCohortName: sessionYears.name,
          targetBranchId: alumniEvents.targetBranchId,
          targetBranchName: branches.name,
          attachmentUrl: alumniEvents.attachmentUrl,
          isCancelled: alumniEvents.isCancelled,
          cancellationReason: alumniEvents.cancellationReason,
          createdBy: alumniEvents.createdBy,
          createdAt: alumniEvents.createdAt,
        })
        .from(alumniEvents)
        .leftJoin(sessionYears, eq(alumniEvents.targetCohortSessionYearId, sessionYears.id))
        .leftJoin(branches, eq(alumniEvents.targetBranchId, branches.id))
        .where(eq(alumniEvents.tenantId, tenantId))
        .orderBy(desc(alumniEvents.startsAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(alumniEvents).where(eq(alumniEvents.tenantId, tenantId)),
    ]);

    const eventIds = rows.map(r => r.id);
    const rsvpCounts = eventIds.length > 0
      ? await db
          .select({
            eventId: alumniEventRsvps.eventId,
            status: alumniEventRsvps.status,
            isWaitlisted: alumniEventRsvps.isWaitlisted,
            count: count(),
          })
          .from(alumniEventRsvps)
          .where(and(eq(alumniEventRsvps.tenantId, tenantId), inArray(alumniEventRsvps.eventId, eventIds)))
          .groupBy(alumniEventRsvps.eventId, alumniEventRsvps.status, alumniEventRsvps.isWaitlisted)
      : [];

    const checkedInCounts = eventIds.length > 0
      ? await db
          .select({
            eventId: alumniEventRsvps.eventId,
            count: count(),
          })
          .from(alumniEventRsvps)
          .where(
            and(
              eq(alumniEventRsvps.tenantId, tenantId),
              inArray(alumniEventRsvps.eventId, eventIds),
              eq(alumniEventRsvps.checkedIn, true),
            ),
          )
          .groupBy(alumniEventRsvps.eventId)
      : [];

    const countsByEvent = new Map<string, Record<string, number>>();
    const waitlistByEvent = new Map<string, number>();
    const checkedInByEvent = new Map<string, number>();

    for (const r of rsvpCounts) {
      if (!eventIds.includes(r.eventId)) {
        continue;
      }
      const existing = countsByEvent.get(r.eventId) ?? {};
      existing[r.status] = (existing[r.status] ?? 0) + Number(r.count);
      countsByEvent.set(r.eventId, existing);

      if (r.isWaitlisted) {
        waitlistByEvent.set(r.eventId, (waitlistByEvent.get(r.eventId) ?? 0) + Number(r.count));
      }
    }

    for (const c of checkedInCounts) {
      checkedInByEvent.set(c.eventId, Number(c.count));
    }

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({
        ...r,
        rsvpCounts: countsByEvent.get(r.id) ?? {},
        waitlistCount: waitlistByEvent.get(r.id) ?? 0,
        checkedInCount: checkedInByEvent.get(r.id) ?? 0,
      })),
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

    const [inserted] = await db
      .insert(alumniEvents)
      .values({
        tenantId,
        title: body.title,
        description: body.description ?? null,
        location: body.location ?? null,
        startsAt: body.startsAt,
        endsAt: body.endsAt ?? null,
        isPublished: body.isPublished ?? true,
        capacity: body.capacity ?? null,
        targetCohortSessionYearId: body.targetCohortSessionYearId ?? null,
        targetBranchId: body.targetBranchId ?? null,
        attachmentUrl: body.attachmentUrl ?? null,
        createdBy: context.userId,
      })
      .returning();

    recordAudit(context, 'create', 'alumni_event', inserted!.id, {
      title: body.title,
      isPublished: body.isPublished,
      capacity: body.capacity,
    });

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

    const [updated] = await db
      .update(alumniEvents)
      .set(fields)
      .where(and(eq(alumniEvents.id, id), eq(alumniEvents.tenantId, tenantId)))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'NOT_FOUND', 'Événement introuvable.');
    }
    recordAudit(context, 'update', 'alumni_event', id, { ...fields });

    return NextResponse.json({ success: true, data: updated, message: 'Événement mis à jour avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const body = await parseJson(request, checkInSchema);

    // Verify event exists in tenant
    const [event] = await db
      .select({ id: alumniEvents.id })
      .from(alumniEvents)
      .where(and(eq(alumniEvents.id, body.eventId), eq(alumniEvents.tenantId, tenantId)))
      .limit(1);

    if (!event) {
      throw new ApiError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
    }

    const nowIso = new Date().toISOString();
    const [updatedRsvp] = await db
      .update(alumniEventRsvps)
      .set({
        checkedIn: body.checkedIn,
        checkedInAt: body.checkedIn ? nowIso : null,
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(alumniEventRsvps.tenantId, tenantId),
          eq(alumniEventRsvps.eventId, body.eventId),
          eq(alumniEventRsvps.alumnusId, body.alumnusId),
        ),
      )
      .returning();

    if (!updatedRsvp) {
      throw new ApiError(404, 'RSVP_NOT_FOUND', 'Inscription introuvable pour ce participant.');
    }

    recordAudit(context, 'update', 'alumni_event_checkin', updatedRsvp.id, {
      eventId: body.eventId,
      alumnusId: body.alumnusId,
      checkedIn: body.checkedIn,
    });

    return NextResponse.json({
      success: true,
      data: updatedRsvp,
      message: body.checkedIn ? 'Participant marqué présent' : 'Présence annulée',
    });
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

    // 1. Fetch event within tenant scope
    const [event] = await db
      .select({
        id: alumniEvents.id,
        isPublished: alumniEvents.isPublished,
        isCancelled: alumniEvents.isCancelled,
      })
      .from(alumniEvents)
      .where(and(eq(alumniEvents.id, id), eq(alumniEvents.tenantId, tenantId)))
      .limit(1);

    if (!event) {
      throw new ApiError(404, 'NOT_FOUND', 'Événement introuvable.');
    }

    // 2. Query RSVP and check-in history count
    const [rsvpRecord] = await db
      .select({ count: count() })
      .from(alumniEventRsvps)
      .where(and(eq(alumniEventRsvps.tenantId, tenantId), eq(alumniEventRsvps.eventId, id)))
      .limit(1);

    const hasRsvps = Number(rsvpRecord?.count ?? 0) > 0;

    // 3. Deletion Safety Invariant:
    // Published events OR events with RSVP/check-in history cannot be destructively deleted.
    // They must use the cancellation lifecycle instead to preserve attendee truth.
    if (event.isPublished || hasRsvps) {
      throw new ApiError(
        409,
        'CANNOT_DELETE_PUBLISHED_OR_USED_EVENT',
        'Impossible de supprimer un événement publié ou ayant un historique de participations. Veuillez l\'annuler à la place pour préserver l\'historique.',
      );
    }

    // 4. Hard delete allowed ONLY for unused draft events
    const [deleted] = await db
      .delete(alumniEvents)
      .where(and(eq(alumniEvents.id, id), eq(alumniEvents.tenantId, tenantId)))
      .returning({ id: alumniEvents.id });

    if (!deleted) {
      throw new ApiError(404, 'NOT_FOUND', 'Événement introuvable.');
    }

    recordAudit(context, 'delete', 'alumni_event', id);

    return NextResponse.json({ success: true, id, message: 'Événement supprimé avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
