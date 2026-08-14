import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { db } from '@/libs/DB';
import { employeeProfiles, salaryAdvances, user } from '@/models/Schema';

const reviewSchema = z.object({ id: z.string().uuid(), action: z.enum(['approved', 'rejected']), approvedAmount: z.number().positive().optional(), rejectionReason: z.string().trim().max(500).optional() }).strict();

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);
    await requireCapability(ctx, 'payroll.advances.manage');
    const rows = await db.select({ id: salaryAdvances.id, employeeId: salaryAdvances.employeeId, employeeName: user.name, requestedAmount: salaryAdvances.requestedAmount, approvedAmount: salaryAdvances.approvedAmount, repaidAmount: salaryAdvances.repaidAmount, monthlyInstallment: salaryAdvances.monthlyInstallment, reason: salaryAdvances.reason, status: salaryAdvances.status, requestedAt: salaryAdvances.requestedAt, rejectionReason: salaryAdvances.rejectionReason }).from(salaryAdvances).innerJoin(employeeProfiles, and(eq(salaryAdvances.employeeId, employeeProfiles.id), eq(employeeProfiles.tenantId, tenantId))).innerJoin(user, eq(employeeProfiles.userId, user.id)).where(eq(salaryAdvances.tenantId, tenantId)).orderBy(desc(salaryAdvances.createdAt));
    return NextResponse.json({ success: true, data: rows.map(r => ({ ...r, requestedAmount: Number(r.requestedAmount), approvedAmount: r.approvedAmount == null ? null : Number(r.approvedAmount), repaidAmount: Number(r.repaidAmount), monthlyInstallment: r.monthlyInstallment == null ? null : Number(r.monthlyInstallment) })) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);
    await requireCapability(ctx, 'payroll.advances.manage');
    const body = await parseJson(request, reviewSchema);
    const [current] = await db.select().from(salaryAdvances).where(and(eq(salaryAdvances.id, body.id), eq(salaryAdvances.tenantId, tenantId))).limit(1);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Demande d’avance introuvable.');
    if (current.status !== 'pending') throw new ApiError(409, 'ALREADY_REVIEWED', 'Cette demande a déjà été traitée.');
    if (current.userId === ctx.userId) throw new ApiError(409, 'SELF_APPROVAL_FORBIDDEN', 'Vous ne pouvez pas approuver votre propre demande.');
    if (body.action === 'rejected' && !body.rejectionReason) throw new ApiError(400, 'REJECTION_REASON_REQUIRED', 'Le motif du refus est obligatoire.');
    const [updated] = await db.update(salaryAdvances).set({ status: body.action, approvedAmount: body.action === 'approved' ? (body.approvedAmount ?? Number(current.requestedAmount)) : null, approvedAt: body.action === 'approved' ? new Date().toISOString() : null, approverId: ctx.userId, rejectionReason: body.action === 'rejected' ? body.rejectionReason : null, updatedAt: new Date().toISOString() }).where(and(eq(salaryAdvances.id, body.id), eq(salaryAdvances.tenantId, tenantId), eq(salaryAdvances.status, 'pending'))).returning();
    if (!updated) throw new ApiError(409, 'STATE_CHANGED', 'La demande a été traitée entre-temps.');
    recordAudit(ctx, 'update', 'salary_advance', body.id);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) { return apiErrorResponse(error); }
}
