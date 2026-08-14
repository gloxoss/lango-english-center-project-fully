import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { meetingSlots } from '@/models/Schema';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';

// Parent meetings — open teacher slots a guardian may book. Relationship-scoped:
// an unlinked or non-effective child is a uniform 404; the communication right
// must be granted. Booking itself reuses the existing link-gated
// POST /api/academics/meeting-slots/book route.
export async function GET(request: Request, { params }: { params: Promise<{ relationshipId: string }> }) {
  try {
    const ctx = await requireParentContext(request);
    const { relationshipId } = await params;
    await requireRelationship(ctx, relationshipId, { communication: true });
    const tenantId = ctx.tenantId as string;
    const rows = await db
      .select({
        id: meetingSlots.id,
        teacherId: meetingSlots.teacherId,
        startTime: meetingSlots.startTime,
        endTime: meetingSlots.endTime,
        status: meetingSlots.status,
      })
      .from(meetingSlots)
      .where(and(eq(meetingSlots.tenantId, tenantId), eq(meetingSlots.status, 'open')))
      .orderBy(asc(meetingSlots.startTime))
      .limit(20);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
