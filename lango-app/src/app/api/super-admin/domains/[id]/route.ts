import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/libs/DB';
import { tenantDomains } from '@/features/platform/models/domains-schema';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { eq } from 'drizzle-orm';

const updateDomainSchema = z.object({
  status: z.enum(['pending', 'verified', 'approved', 'rejected']),
  reason: z.string().max(500).optional(),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    const resolvedParams = await params;

    const parsed = await parseJson(request, updateDomainSchema);

    const [existing] = await db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.id, resolvedParams.id))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Domaine introuvable.');
    }

    const updates: Partial<typeof tenantDomains.$inferInsert> = {
      status: parsed.status,
      updatedAt: new Date().toISOString(),
    };

    if (parsed.status === 'approved') {
      updates.approvedAt = new Date().toISOString();
      updates.approvedById = context.userId;
    } else if (parsed.status === 'rejected') {
      updates.approvedAt = null;
      updates.approvedById = null;
    }

    const [updated] = await db
      .update(tenantDomains)
      .set(updates)
      .where(eq(tenantDomains.id, resolvedParams.id))
      .returning();

    const auditContext = { ...context, tenantId: existing.tenantId };
    if (updated) {
      recordAudit(auditContext, 'update', 'tenant_domain', updated.id, {
        status: updated.status,
        domain: updated.domain,
        reason: parsed.reason,
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    const resolvedParams = await params;

    const [existing] = await db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.id, resolvedParams.id))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Domaine introuvable.');
    }

    await db
      .delete(tenantDomains)
      .where(eq(tenantDomains.id, resolvedParams.id));

    const auditContext = { ...context, tenantId: existing.tenantId };
    recordAudit(auditContext, 'delete', 'tenant_domain', resolvedParams.id, {
      domain: existing.domain,
    });

    return NextResponse.json({ success: true, message: 'Domaine supprimé avec succès.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

