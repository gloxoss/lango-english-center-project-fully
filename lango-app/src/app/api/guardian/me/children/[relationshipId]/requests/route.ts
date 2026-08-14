import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';
import { parentRequests } from '@/features/parent/models/parent-schema';

// GET/POST /api/guardian/me/children/[relationshipId]/requests — parent → school
// request inbox (profile correction, leave/permission, document request, other).
// Relationship-scoped (uniform 404 for a non-owned/non-effective child). A
// request records *intent only*: the destination module performs the actual
// change in its own tables; this never grants the parent a privileged write.

const REQUEST_TYPES = ['profile_correction', 'leave_permission', 'document_request', 'other'] as const;

const createRequestSchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  subject: z.string().trim().min(3).max(255),
  body: z.string().trim().max(2000).optional().nullable(),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ relationshipId: string }> }) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;
    const auth = await requireRelationship(ctx, relationshipId);

    const rows = await db
      .select({
        id: parentRequests.id,
        requestType: parentRequests.requestType,
        subject: parentRequests.subject,
        body: parentRequests.body,
        status: parentRequests.status,
        decisionNotes: parentRequests.decisionNotes,
        createdAt: parentRequests.createdAt,
      })
      .from(parentRequests)
      .where(and(
        eq(parentRequests.tenantId, ctx.tenantId as string),
        eq(parentRequests.studentId, auth.studentId),
      ))
      .orderBy(desc(parentRequests.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ relationshipId: string }> }) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;
    const auth = await requireRelationship(ctx, relationshipId);
    const body = await parseJson(request, createRequestSchema);

    const [inserted] = await db
      .insert(parentRequests)
      .values({
        tenantId: ctx.tenantId as string,
        guardianId: auth.guardianId,
        studentId: auth.studentId,
        requestType: body.requestType,
        subject: body.subject,
        body: body.body ?? null,
        status: 'pending',
      })
      .returning();

    recordAudit(ctx, 'create', 'parent_request', inserted!.id, {
      studentId: auth.studentId,
      requestType: body.requestType,
    });

    return NextResponse.json({
      success: true,
      data: inserted,
      message: 'Demande soumise avec succès.',
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
