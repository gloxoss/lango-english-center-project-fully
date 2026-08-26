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
    };

    if (parsed.status === 'approved') {
      updates.approvedAt = new Date().toISOString();
      updates.approvedById = context.userId;
    }

    const [updated] = await db
      .update(tenantDomains)
      .set(updates)
      .where(eq(tenantDomains.id, resolvedParams.id))
      .returning();

    // Context may not have a tenantId for super_admin routes, but we can pass existing.tenantId if needed
    // However, recordAudit usually expects context to have a tenantId or it skips it if it's super_admin.
    // The audit log for tenant_domain modification is useful.
    const auditContext = { ...context, tenantId: existing.tenantId };
    if (updated) {
      // Fire and forget audit
      recordAudit(auditContext, 'update', 'tenant_domain', updated?.id, { status: updated?.status });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
