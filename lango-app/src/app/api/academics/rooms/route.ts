import type { RoomRow } from '@/features/academics/services/room-registry';
import { and, count, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  attachOccupancy,
  fetchScheduleByRoomLabel,
  normalizeLabel,

  weekdayOf,
} from '@/features/academics/services/room-registry';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { academicRooms } from '@/models/Schema';

const equipmentSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(30, 'Une salle ne peut pas déclarer plus de 30 équipements.')
  .optional();

export const roomCreateSchema = z.object({
  name: z.string().trim().min(1, 'Le nom de la salle est requis.').max(100),
  code: z.string().trim().max(50).nullable().optional(),
  building: z.string().trim().max(100).nullable().optional(),
  floor: z.string().trim().max(50).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  roomType: z.string().trim().max(50).nullable().optional(),
  equipment: equipmentSchema,
  status: z.enum(['available', 'maintenance']).optional().default('available'),
  isActive: z.boolean().optional().default(true),
}).strict();

export const roomUpdateSchema = roomCreateSchema
  .partial()
  .extend({ id: z.string().uuid() })
  .strict();

/** Empty string is how a cleared form field arrives; store it as NULL. */
function nullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant', 'receptionist']);
    await requireCapability(context, 'academics.read');
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(academicRooms.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(academicRooms).where(where).orderBy(academicRooms.name).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(academicRooms).where(where),
    ]);

    // Occupancy is computed from the live timetable rather than stored, so the
    // Salles screen can never show a room as free while a class sits in it.
    const now = new Date();
    const scheduleByLabel = await fetchScheduleByRoomLabel(tenantId, weekdayOf(now));
    const data = attachOccupancy(rows as RoomRow[], scheduleByLabel, now);

    return NextResponse.json({
      success: true,
      data,
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
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, roomCreateSchema);
    const code = nullableText(body.code) ?? null;

    const [existing] = await db
      .select({ id: academicRooms.id })
      .from(academicRooms)
      .where(and(eq(academicRooms.tenantId, tenantId), eq(academicRooms.name, body.name)))
      .limit(1);

    if (existing) {
      throw new ApiError(409, 'ALREADY_EXISTS', 'Une salle avec ce nom existe déjà dans cet établissement.');
    }

    if (code) {
      const [dupCode] = await db
        .select({ id: academicRooms.id })
        .from(academicRooms)
        .where(and(eq(academicRooms.tenantId, tenantId), eq(academicRooms.code, code)))
        .limit(1);

      if (dupCode) {
        throw new ApiError(409, 'ALREADY_EXISTS', 'Une salle avec ce code existe déjà dans cet établissement.');
      }
    }

    const [inserted] = await db
      .insert(academicRooms)
      .values({
        tenantId,
        name: body.name,
        code,
        building: nullableText(body.building) ?? null,
        floor: nullableText(body.floor) ?? null,
        capacity: body.capacity ?? null,
        roomType: nullableText(body.roomType) ?? null,
        equipment: body.equipment ?? [],
        status: body.status ?? 'available',
        isActive: body.isActive ?? true,
      })
      .returning();

    recordAudit(context, 'create', 'academic_room', inserted!.id);

    return NextResponse.json({ success: true, data: inserted! }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, roomUpdateSchema);

    const [existing] = await db
      .select()
      .from(academicRooms)
      .where(and(eq(academicRooms.id, body.id), eq(academicRooms.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'La salle demandée est introuvable.');
    }

    if (body.name && body.name !== existing.name) {
      const [dup] = await db
        .select({ id: academicRooms.id })
        .from(academicRooms)
        .where(and(eq(academicRooms.tenantId, tenantId), eq(academicRooms.name, body.name)))
        .limit(1);

      if (dup) {
        throw new ApiError(409, 'ALREADY_EXISTS', 'Une autre salle avec ce nom existe déjà.');
      }
    }

    const nextCode = nullableText(body.code);
    if (nextCode !== undefined && nextCode !== null && normalizeLabel(nextCode) !== normalizeLabel(existing.code)) {
      // Excludes self, so re-saving a room without changing its code is not a conflict.
      const [dupCode] = await db
        .select({ id: academicRooms.id })
        .from(academicRooms)
        .where(and(
          eq(academicRooms.tenantId, tenantId),
          eq(academicRooms.code, nextCode),
          ne(academicRooms.id, body.id),
        ))
        .limit(1);

      if (dupCode) {
        throw new ApiError(409, 'ALREADY_EXISTS', 'Une autre salle avec ce code existe déjà.');
      }
    }

    const [updated] = await db
      .update(academicRooms)
      .set({
        name: body.name ?? existing.name,
        code: nextCode !== undefined ? nextCode : existing.code,
        building: body.building !== undefined ? nullableText(body.building) ?? null : existing.building,
        floor: body.floor !== undefined ? nullableText(body.floor) ?? null : existing.floor,
        capacity: body.capacity !== undefined ? body.capacity : existing.capacity,
        roomType: body.roomType !== undefined ? nullableText(body.roomType) ?? null : existing.roomType,
        equipment: body.equipment !== undefined ? body.equipment : existing.equipment,
        status: body.status !== undefined ? body.status : existing.status,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(academicRooms.id, body.id), eq(academicRooms.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'academic_room', body.id);

    return NextResponse.json({ success: true, data: updated! });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new ApiError(400, 'BAD_REQUEST', 'L\'identifiant de la salle est requis.');
    }

    const [existing] = await db
      .select({ id: academicRooms.id })
      .from(academicRooms)
      .where(and(eq(academicRooms.id, id), eq(academicRooms.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'La salle demandée est introuvable.');
    }

    await db.delete(academicRooms).where(and(eq(academicRooms.id, id), eq(academicRooms.tenantId, tenantId)));
    recordAudit(context, 'delete', 'academic_room', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
