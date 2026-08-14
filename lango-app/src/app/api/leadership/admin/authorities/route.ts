import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import { leadershipApprovalAuthorities, leadershipScopeAssignments } from '@/features/leadership/models/leadership-schema';

const schema = z.object({
  assignmentId: z.string().uuid(), domain: z.enum(['academics', 'attendance', 'finance', 'workforce', 'operations', 'reporting']),
  action: z.string().trim().min(2).max(60), maxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  startsOn: z.string().date(), endsOn: z.string().date().nullable().optional(), delegatedFromAuthorityId: z.string().uuid().nullable().optional(),
}).strict().refine(v => !v.endsOn || v.endsOn >= v.startsOn, { message: 'endsOn must be on or after startsOn', path: ['endsOn'] });

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'leadership.scope.manage');
    const rows = await db.select({
      id: leadershipApprovalAuthorities.id,
      assignmentId: leadershipApprovalAuthorities.assignmentId,
      userId: leadershipScopeAssignments.userId,
      userName: user.name,
      domain: leadershipApprovalAuthorities.domain,
      action: leadershipApprovalAuthorities.action,
      maxAmount: leadershipApprovalAuthorities.maxAmount,
      startsOn: leadershipApprovalAuthorities.startsOn,
      endsOn: leadershipApprovalAuthorities.endsOn,
      delegatedFromAuthorityId: leadershipApprovalAuthorities.delegatedFromAuthorityId,
      status: leadershipApprovalAuthorities.status,
    }).from(leadershipApprovalAuthorities)
      .innerJoin(leadershipScopeAssignments, and(eq(leadershipScopeAssignments.id, leadershipApprovalAuthorities.assignmentId), eq(leadershipScopeAssignments.tenantId, tenantId)))
      .innerJoin(user, and(eq(user.id, leadershipScopeAssignments.userId), eq(user.tenantId, tenantId)))
      .where(eq(leadershipApprovalAuthorities.tenantId, tenantId))
      .orderBy(desc(leadershipApprovalAuthorities.createdAt));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'leadership.scope.manage');
    const body = await parseJson(request, schema);
    const [assignment] = await db.select({ id: leadershipScopeAssignments.id }).from(leadershipScopeAssignments)
      .where(and(eq(leadershipScopeAssignments.id, body.assignmentId), eq(leadershipScopeAssignments.tenantId, tenantId), eq(leadershipScopeAssignments.status, 'active'))).limit(1);
    if (!assignment) throw new ApiError(404, 'ASSIGNMENT_NOT_FOUND', 'Périmètre introuvable.');
    if (body.delegatedFromAuthorityId) {
      const [source] = await db.select({ id: leadershipApprovalAuthorities.id }).from(leadershipApprovalAuthorities)
        .where(and(eq(leadershipApprovalAuthorities.id, body.delegatedFromAuthorityId), eq(leadershipApprovalAuthorities.tenantId, tenantId), eq(leadershipApprovalAuthorities.status, 'active'))).limit(1);
      if (!source) throw new ApiError(404, 'DELEGATION_SOURCE_NOT_FOUND', 'Autorité source introuvable.');
    }
    const [created] = await db.insert(leadershipApprovalAuthorities).values({ ...body, maxAmount: body.maxAmount ?? null, endsOn: body.endsOn ?? null, delegatedFromAuthorityId: body.delegatedFromAuthorityId ?? null, tenantId, createdById: ctx.userId }).returning();
    recordAudit(ctx, 'create', 'leadership_approval_authority', created!.id, { domain: body.domain, action: body.action });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
