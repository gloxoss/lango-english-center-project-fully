import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { identityBadgeCredentials } from '@/models/Schema';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    
    const badgeId = id;

    if (!badgeId) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    // Revoke the badge instead of hard deleting it to keep audit trails intact
    await db
      .update(identityBadgeCredentials)
      .set({
        status: 'revoked',
        revokedAt: new Date().toISOString(),
      })
      .where(and(
        eq(identityBadgeCredentials.id, badgeId),
        eq(identityBadgeCredentials.tenantId, tenantId)
      ));

    await recordAudit(context, 'delete', 'identity_badge', badgeId);

    return NextResponse.json({
      success: true,
      message: 'Badge révoqué avec succès',
      id: badgeId,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
