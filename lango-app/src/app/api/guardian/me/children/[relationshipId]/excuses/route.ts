import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendanceExcuses } from '@/models/Schema';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';

// GET/POST /api/guardian/me/children/[relationshipId]/excuses — the child's
// justification (excuse) requests, relationship-scoped. The child is
// server-resolved from the relationship (404 if not this guardian's effective
// child) and the `attendance` right is required (403). The shared
// /api/attendance/excuses route is NOT reused because its parent branch trusts
// a client-chosen studentId (IDOR); here the studentId always comes from the
// server-resolved relationship.
type RouteParams = { params: Promise<{ relationshipId: string }> };

const createExcuseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  reason: z.string().trim().min(3).max(500),
}).strict();

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;
    const auth = await requireRelationship(ctx, relationshipId, { attendance: true });

    const rows = await db
      .select({
        id: attendanceExcuses.id,
        date: attendanceExcuses.date,
        reason: attendanceExcuses.reason,
        documentUrl: attendanceExcuses.documentUrl,
        documentFileExt: attendanceExcuses.documentFileExt,
        status: attendanceExcuses.status,
        rejectionReason: attendanceExcuses.rejectionReason,
        reviewedAt: attendanceExcuses.reviewedAt,
        createdAt: attendanceExcuses.createdAt,
      })
      .from(attendanceExcuses)
      .where(and(
        eq(attendanceExcuses.tenantId, ctx.tenantId as string),
        eq(attendanceExcuses.studentId, auth.studentId),
      ))
      .orderBy(desc(attendanceExcuses.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;
    const auth = await requireRelationship(ctx, relationshipId, { attendance: true });

    const body = await parseJson(request, createExcuseSchema);

    const [inserted] = await db
      .insert(attendanceExcuses)
      .values({
        tenantId: ctx.tenantId as string,
        studentId: auth.studentId,
        date: body.date,
        reason: body.reason,
        status: 'pending',
      })
      .returning();

    recordAudit(ctx, 'create', 'attendance_excuses', inserted!.id, {
      studentId: auth.studentId,
      date: body.date,
    });

    return NextResponse.json({
      success: true,
      data: inserted,
      message: 'Demande de justification soumise avec succès.',
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
