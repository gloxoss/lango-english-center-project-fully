import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { payrollAdjustments, payrollSettingsVersions, salaryComponentVersions, salaryStructureVersions } from '@/models/Schema';

const paramsSchema = z.object({ resource: z.enum(['settings','components','structures','adjustments']), id: z.string().uuid() });
const bodySchema = z.object({ action: z.enum(['publish','review','approve','reject','retire']), reason: z.string().trim().max(500).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId); await requireCapability(ctx, 'payroll.configure');
    const p = paramsSchema.parse(await params); const body = await parseJson(request, bodySchema); const now = new Date().toISOString();
    let data: unknown;
    if (p.resource === 'settings') {
      if (body.action !== 'publish') throw new ApiError(422, 'INVALID_ACTION', 'Action invalide.');
      [data] = await db.update(payrollSettingsVersions).set({ status: 'published', publishedById: ctx.userId, publishedAt: now }).where(and(eq(payrollSettingsVersions.tenantId, tenantId), eq(payrollSettingsVersions.id, p.id), eq(payrollSettingsVersions.status, 'draft'))).returning();
    } else if (p.resource === 'components') {
      const status = body.action === 'publish' ? 'published' : body.action === 'retire' ? 'retired' : null;
      if (!status) throw new ApiError(422, 'INVALID_ACTION', 'Action invalide.');
      [data] = await db.update(salaryComponentVersions).set({ status, publishedById: status === 'published' ? ctx.userId : undefined, publishedAt: status === 'published' ? now : undefined }).where(and(eq(salaryComponentVersions.tenantId, tenantId), eq(salaryComponentVersions.id, p.id))).returning();
    } else if (p.resource === 'structures') {
      const status = body.action === 'review' ? 'reviewed' : body.action === 'publish' ? 'published' : body.action === 'retire' ? 'retired' : null;
      if (!status) throw new ApiError(422, 'INVALID_ACTION', 'Action invalide.');
      [data] = await db.update(salaryStructureVersions).set({ status, publishedById: status === 'published' ? ctx.userId : undefined, publishedAt: status === 'published' ? now : undefined }).where(and(eq(salaryStructureVersions.tenantId, tenantId), eq(salaryStructureVersions.id, p.id))).returning();
    } else {
      if (body.action !== 'approve' && body.action !== 'reject') throw new ApiError(422, 'INVALID_ACTION', 'Action invalide.');
      const [item] = await db.select().from(payrollAdjustments).where(and(eq(payrollAdjustments.tenantId, tenantId), eq(payrollAdjustments.id, p.id)));
      if (!item) throw new ApiError(404, 'ADJUSTMENT_NOT_FOUND', 'Ajustement introuvable.');
      if (item.requesterId === ctx.userId && body.action === 'approve') throw new ApiError(403, 'PAYROLL_SELF_APPROVAL', 'Le demandeur ne peut pas approuver son ajustement.');
      [data] = await db.update(payrollAdjustments).set({ status: body.action === 'approve' ? 'approved' : 'rejected', approverId: ctx.userId, approvedAt: body.action === 'approve' ? now : null }).where(and(eq(payrollAdjustments.tenantId, tenantId), eq(payrollAdjustments.id, p.id), eq(payrollAdjustments.status, 'submitted'))).returning();
    }
    if (!data) throw new ApiError(409, 'INVALID_TRANSITION', 'La ressource a déjà changé d’état.');
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}
