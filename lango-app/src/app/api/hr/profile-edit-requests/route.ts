import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { employeeProfileEditRequests, employeeProfiles, user } from '@/models/Schema';
import { parseSensitiveProfileChanges } from '@/features/hr/services/profile-edit-requests';

const decisionSchema = z.object({ id: z.string().uuid(), decision: z.enum(['approved', 'rejected']), reason: z.string().trim().max(500).optional() }).strict().superRefine((v, ctx) => {
  if (v.decision === 'rejected' && !v.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A rejection reason is required' });
});
async function guard(request: Request) {
  const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx);
  await requireCapability(ctx, 'hr.employee.manage'); await requireCapability(ctx, 'hr.sensitive.read'); return { ctx, tenantId };
}
export async function GET(request: Request) {
  try {
    const { tenantId } = await guard(request);
    const rows = await db.select({ id: employeeProfileEditRequests.id, employeeId: employeeProfileEditRequests.employeeId, userId: employeeProfileEditRequests.userId, employeeName: user.name, requestType: employeeProfileEditRequests.requestType, proposedChanges: employeeProfileEditRequests.proposedChanges, reason: employeeProfileEditRequests.reason, status: employeeProfileEditRequests.status, reauthenticatedAt: employeeProfileEditRequests.reauthenticatedAt, createdAt: employeeProfileEditRequests.createdAt }).from(employeeProfileEditRequests)
      .innerJoin(user, and(eq(user.id, employeeProfileEditRequests.userId), eq(user.tenantId, tenantId))).where(eq(employeeProfileEditRequests.tenantId, tenantId)).orderBy(desc(employeeProfileEditRequests.createdAt));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) { return apiErrorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    const { ctx, tenantId } = await guard(request); const body = await parseJson(request, decisionSchema);
    const result = await db.transaction(async tx => {
      const [pending] = await tx.select().from(employeeProfileEditRequests).where(and(eq(employeeProfileEditRequests.id, body.id), eq(employeeProfileEditRequests.tenantId, tenantId), eq(employeeProfileEditRequests.status, 'pending'))).for('update').limit(1);
      if (!pending) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Demande introuvable ou déjà traitée.');
      if (pending.userId === ctx.userId) throw new ApiError(409, 'SELF_APPROVAL_FORBIDDEN', 'Vous ne pouvez pas approuver votre propre demande.');
      if (body.decision === 'approved') {
        const changes = parseSensitiveProfileChanges(pending.proposedChanges);
        const [updated] = await tx.update(employeeProfiles).set({ ...changes, updatedAt: new Date().toISOString() }).where(and(eq(employeeProfiles.id, pending.employeeId), eq(employeeProfiles.tenantId, tenantId), eq(employeeProfiles.userId, pending.userId))).returning({ id: employeeProfiles.id });
        if (!updated) throw new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'Profil employé introuvable.');
      }
      const [decided] = await tx.update(employeeProfileEditRequests).set({ status: body.decision, reviewerId: ctx.userId, reviewedAt: new Date().toISOString(), rejectionReason: body.decision === 'rejected' ? body.reason! : null }).where(and(eq(employeeProfileEditRequests.id, pending.id), eq(employeeProfileEditRequests.tenantId, tenantId), eq(employeeProfileEditRequests.status, 'pending'))).returning();
      if (!decided) throw new ApiError(409, 'REQUEST_STATE_CHANGED', 'La demande a été traitée simultanément.');
      return decided;
    });
    recordAudit(ctx, 'update', 'employee_profile_edit_request', result.id, { decision: body.decision });
    return NextResponse.json({ success: true, data: result });
  } catch (error) { return apiErrorResponse(error); }
}
