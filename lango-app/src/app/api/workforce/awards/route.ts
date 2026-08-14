import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { db } from '@/libs/DB';
import { employeeAwards, employeeProfiles, user } from '@/models/Schema';

const createSchema = z.object({ employeeId: z.string().uuid(), title: z.string().trim().min(1).max(255), category: z.enum(['excellence', 'innovation', 'tenure', 'leadership', 'teamwork', 'custom']), monetaryReward: z.number().min(0).max(500000).default(0), giftDescription: z.string().trim().max(500).optional(), awardDate: z.string().date(), summary: z.string().trim().max(1000).optional(), presentedBy: z.string().trim().max(255).optional() }).strict();

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx); await requireWorkforceAddon(tenantId); await requireCapability(ctx, 'payroll.awards.manage');
    const rows = await db.select({ id: employeeAwards.id, employeeId: employeeAwards.employeeId, employeeName: user.name, title: employeeAwards.title, category: employeeAwards.category, monetaryReward: employeeAwards.monetaryReward, giftDescription: employeeAwards.giftDescription, awardDate: employeeAwards.awardDate, summary: employeeAwards.summary, presentedBy: employeeAwards.presentedBy, status: employeeAwards.status }).from(employeeAwards).innerJoin(employeeProfiles, and(eq(employeeAwards.employeeId, employeeProfiles.id), eq(employeeProfiles.tenantId, tenantId))).innerJoin(user, eq(employeeProfiles.userId, user.id)).where(eq(employeeAwards.tenantId, tenantId)).orderBy(desc(employeeAwards.awardDate));
    return NextResponse.json({ success: true, data: rows.map(r => ({ ...r, monetaryReward: Number(r.monetaryReward) })) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request); const tenantId = requireTenant(ctx); await requireWorkforceAddon(tenantId); await requireCapability(ctx, 'payroll.awards.manage'); const body = await parseJson(request, createSchema);
    const [employee] = await db.select({ id: employeeProfiles.id, userId: employeeProfiles.userId }).from(employeeProfiles).where(and(eq(employeeProfiles.id, body.employeeId), eq(employeeProfiles.tenantId, tenantId))).limit(1);
    if (!employee?.userId) return NextResponse.json({ success: false, error: { message: 'Collaborateur introuvable ou sans compte lié.' } }, { status: 404 });
    if (employee.userId === ctx.userId) return NextResponse.json({ success: false, error: { message: 'Vous ne pouvez pas vous attribuer une distinction.' } }, { status: 409 });
    const { employeeId: _employeeId, ...award } = body;
    const [created] = await db.insert(employeeAwards).values({ tenantId, employeeId: employee.id, userId: employee.userId, ...award, giftDescription: award.giftDescription ?? null, summary: award.summary ?? null, presentedBy: award.presentedBy ?? null, status: 'granted' }).returning();
    if (!created) throw new Error('Award insert returned no row');
    recordAudit(ctx, 'create', 'employee_award', created.id);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
