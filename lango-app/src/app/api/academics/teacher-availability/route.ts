import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { teacherAvailability, user } from '@/models/Schema';

const slotSchema = z.object({ teacherId: z.string().min(1).optional(), dayOfWeek: z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const requested = new URL(request.url).searchParams.get('teacherId');
    const teacherId = context.role === 'teacher' ? context.userId : requested;
    const filters = [eq(teacherAvailability.tenantId, tenantId)];
    if (teacherId) filters.push(eq(teacherAvailability.teacherId, teacherId));
    const rows = await db.select().from(teacherAvailability).where(and(...filters));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, slotSchema);
    const teacherId = context.role === 'teacher' ? context.userId : body.teacherId;
    if (!teacherId || body.startTime >= body.endTime) throw new ApiError(422, 'INVALID_AVAILABILITY', 'Créneau de disponibilité invalide.');
    const [teacher] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher'))).limit(1);
    if (!teacher) throw new ApiError(422, 'INVALID_REFERENCE', 'Enseignant introuvable.');
    const [row] = await db.insert(teacherAvailability).values({ tenantId, teacherId, dayOfWeek: body.dayOfWeek, startTime: body.startTime, endTime: body.endTime }).returning();
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new ApiError(400, 'BAD_REQUEST', 'ID requis.');
    const filters = [eq(teacherAvailability.id, id), eq(teacherAvailability.tenantId, tenantId)];
    if (context.role === 'teacher') filters.push(eq(teacherAvailability.teacherId, context.userId));
    await db.delete(teacherAvailability).where(and(...filters));
    return NextResponse.json({ success: true });
  } catch (error) { return apiErrorResponse(error); }
}
