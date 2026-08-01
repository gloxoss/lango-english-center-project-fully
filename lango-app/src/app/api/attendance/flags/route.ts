import { and, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendanceFlags, guardians, guardianStudents, user } from '@/models/Schema';

const FLAG_TYPES = ['UNJUSTIFIED_ABSENCE', 'REPEATED_LATE', 'CONSECUTIVE_ABSENCE'] as const;
const FLAG_SEVERITIES = ['CRITIQUE', 'ELEVE', 'MOYEN'] as const;

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const statusParam = searchParams.get('status');
    const typeParam = searchParams.get('type');
    const severityParam = searchParams.get('severity');
    const assignedToParam = searchParams.get('assignedToId');

    const conditions = [eq(attendanceFlags.tenantId, tenantId)];
    if (statusParam && ['OPEN', 'RESOLVED'].includes(statusParam)) {
      conditions.push(eq(attendanceFlags.status, statusParam as 'OPEN' | 'RESOLVED'));
    }
    if (typeParam && (FLAG_TYPES as readonly string[]).includes(typeParam)) {
      conditions.push(eq(attendanceFlags.type, typeParam as typeof FLAG_TYPES[number]));
    }
    if (severityParam && (FLAG_SEVERITIES as readonly string[]).includes(severityParam)) {
      conditions.push(eq(attendanceFlags.severity, severityParam as typeof FLAG_SEVERITIES[number]));
    }
    if (assignedToParam) {
      conditions.push(eq(attendanceFlags.assignedToId, assignedToParam));
    }

    const rows = await db
      .select({
        id: attendanceFlags.id,
        studentId: attendanceFlags.studentId,
        studentName: user.name,
        type: attendanceFlags.type,
        status: attendanceFlags.status,
        severity: attendanceFlags.severity,
        assignedToId: attendanceFlags.assignedToId,
        detectedAt: attendanceFlags.detectedAt,
        resolvedAt: attendanceFlags.resolvedAt,
      })
      .from(attendanceFlags)
      .innerJoin(user, eq(attendanceFlags.studentId, user.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceFlags.detectedAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    const staffIds = [...new Set(rows.map(r => r.assignedToId).filter((id): id is string => !!id))];
    const studentIds = [...new Set(rows.map(r => r.studentId))];

    const [staffRows, guardianRows] = await Promise.all([
      staffIds.length ? db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, staffIds)) : Promise.resolve([]),
      studentIds.length
        ? db
            .select({ studentId: guardianStudents.studentId, phone: guardians.phone, isPrimaryContact: guardianStudents.isPrimaryContact })
            .from(guardianStudents)
            .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
            .where(and(eq(guardianStudents.tenantId, tenantId), inArray(guardianStudents.studentId, studentIds)))
        : Promise.resolve([]),
    ]);
    const staffNameById = new Map(staffRows.map(s => [s.id, s.name]));
    const guardianPhoneByStudent = new Map<string, string | null>();
    for (const g of guardianRows) {
      const existing = guardianPhoneByStudent.get(g.studentId);
      if (existing === undefined || g.isPrimaryContact) {
        guardianPhoneByStudent.set(g.studentId, g.phone);
      }
    }

    const enrichedRows = rows.map(r => ({
      ...r,
      assignedToName: r.assignedToId ? (staffNameById.get(r.assignedToId) ?? null) : null,
      guardianPhone: guardianPhoneByStudent.get(r.studentId) ?? null,
    }));

    return NextResponse.json({ success: true, data: enrichedRows, total: enrichedRows.length, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const updateFlagSchema = z.object({
  flagId: z.string().uuid(),
  assignedToId: z.string().min(1).nullable().optional(),
  status: z.enum(['OPEN', 'RESOLVED']).optional(),
}).strict();

export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, updateFlagSchema);

    const [existing] = await db
      .select({ id: attendanceFlags.id })
      .from(attendanceFlags)
      .where(and(eq(attendanceFlags.id, body.flagId), eq(attendanceFlags.tenantId, tenantId)))
      .limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Signalement introuvable');
    }

    const updates: Record<string, unknown> = {};
    if (body.assignedToId !== undefined) {
      updates.assignedToId = body.assignedToId;
    }
    if (body.status) {
      updates.status = body.status;
      updates.resolvedAt = body.status === 'RESOLVED' ? new Date().toISOString() : null;
    }

    const [updated] = await db
      .update(attendanceFlags)
      .set(updates)
      .where(eq(attendanceFlags.id, body.flagId))
      .returning();

    recordAudit(context, 'update', 'attendance_flag', body.flagId, updates);

    return NextResponse.json({ success: true, data: updated, message: 'Signalement mis à jour.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
