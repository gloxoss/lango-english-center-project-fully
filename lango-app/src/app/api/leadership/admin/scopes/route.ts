import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { branches, user } from '@/models/Schema';
import { departments } from '@/features/hr/models/hr-schema';
import { leadershipScopeAssignments } from '@/features/leadership/models/leadership-schema';

const createSchema = z.object({
  userId: z.string().min(1).max(100),
  scopeType: z.enum(['tenant', 'branch', 'department']),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  startsOn: z.string().date(),
  endsOn: z.string().date().nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.endsOn && value.endsOn < value.startsOn) ctx.addIssue({ code: 'custom', message: 'endsOn must be on or after startsOn' });
  if (value.scopeType === 'tenant' && (value.branchId || value.departmentId)) ctx.addIssue({ code: 'custom', message: 'Tenant scope cannot specify branch or department' });
  if (value.scopeType === 'branch' && (!value.branchId || value.departmentId)) ctx.addIssue({ code: 'custom', message: 'Branch scope requires only branchId' });
  if (value.scopeType === 'department' && !value.departmentId) ctx.addIssue({ code: 'custom', message: 'Department scope requires departmentId' });
});

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'leadership.scope.manage');
    const rows = await db.select({
      id: leadershipScopeAssignments.id,
      userId: leadershipScopeAssignments.userId,
      userName: user.name,
      scopeType: leadershipScopeAssignments.scopeType,
      branchId: leadershipScopeAssignments.branchId,
      branchName: branches.name,
      departmentId: leadershipScopeAssignments.departmentId,
      departmentName: departments.name,
      startsOn: leadershipScopeAssignments.startsOn,
      endsOn: leadershipScopeAssignments.endsOn,
      status: leadershipScopeAssignments.status,
    }).from(leadershipScopeAssignments)
      .innerJoin(user, and(eq(user.id, leadershipScopeAssignments.userId), eq(user.tenantId, tenantId)))
      .leftJoin(branches, and(eq(branches.id, leadershipScopeAssignments.branchId), eq(branches.tenantId, tenantId)))
      .leftJoin(departments, and(eq(departments.id, leadershipScopeAssignments.departmentId), eq(departments.tenantId, tenantId)))
      .where(eq(leadershipScopeAssignments.tenantId, tenantId))
      .orderBy(desc(leadershipScopeAssignments.createdAt));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'leadership.scope.manage');
    const body = await parseJson(request, createSchema);

    const [target] = await db.select({ id: user.id }).from(user)
      .where(and(eq(user.id, body.userId), eq(user.tenantId, tenantId), eq(user.userStatus, 'active'))).limit(1);
    if (!target) throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
    if (body.branchId) {
      const [branch] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, body.branchId), eq(branches.tenantId, tenantId), eq(branches.isActive, true))).limit(1);
      if (!branch) throw new ApiError(404, 'BRANCH_NOT_FOUND', 'Filiale introuvable.');
    }
    if (body.departmentId) {
      const [department] = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, body.departmentId), eq(departments.tenantId, tenantId), eq(departments.status, 'active'))).limit(1);
      if (!department) throw new ApiError(404, 'DEPARTMENT_NOT_FOUND', 'Département introuvable.');
    }

    const [created] = await db.insert(leadershipScopeAssignments).values({
      tenantId, userId: body.userId, scopeType: body.scopeType,
      branchId: body.branchId ?? null, departmentId: body.departmentId ?? null,
      startsOn: body.startsOn, endsOn: body.endsOn ?? null, createdById: ctx.userId,
    }).returning();
    recordAudit(ctx, 'create', 'leadership_scope_assignment', created!.id, { scopeType: body.scopeType, targetUserId: body.userId });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
