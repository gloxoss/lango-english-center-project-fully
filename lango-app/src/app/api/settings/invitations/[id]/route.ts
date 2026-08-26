import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { tenantInvitations } from '@/models/Schema';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'users.manage');

    const [existing] = await db
      .select()
      .from(tenantInvitations)
      .where(and(eq(tenantInvitations.id, id), eq(tenantInvitations.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Invitation non trouvée.');
    }

    const [updated] = await db
      .update(tenantInvitations)
      .set({
        status: 'revoked',
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(tenantInvitations.id, id), eq(tenantInvitations.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'delete', 'invitation', id, { email: existing.email });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Invitation révoquée avec succès.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
