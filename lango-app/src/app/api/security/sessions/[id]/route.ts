import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { session, user } from '@/models/Schema';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.security.manage');

    const { id } = await params;

    // Only sessions belonging to a user of this tenant may be revoked.
    const [target] = await db
      .select({ id: session.id, userId: session.userId })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(and(eq(session.id, id), eq(user.tenantId, tenantId)))
      .limit(1);

    if (!target) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session introuvable dans cet établissement.');
    }

    await db.delete(session).where(eq(session.id, id));
    recordAudit(context, 'update', 'session', id, { action: 'revoke' });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
