import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { scannerSessions } from '@/models/Schema';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');

    const [updated] = await db
      .update(scannerSessions)
      .set({ endedAt: new Date().toISOString(), status: 'closed' })
      .where(and(eq(scannerSessions.id, id), eq(scannerSessions.tenantId, tenantId)))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session de scan introuvable.');
    }

    recordAudit(context, 'update', 'scanner_session', id);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
