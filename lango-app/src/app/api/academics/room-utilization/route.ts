import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classScheduleSlots } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    const roomStats = await db
      .select({
        roomLabel: classScheduleSlots.roomLabel,
        totalSlots: sql<number>`count(*)::int`,
      })
      .from(classScheduleSlots)
      .where(eq(classScheduleSlots.tenantId, tenantId))
      .groupBy(classScheduleSlots.roomLabel);

    return NextResponse.json({
      success: true,
      data: roomStats,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
