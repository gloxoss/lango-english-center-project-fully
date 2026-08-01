import { and, desc, eq, isNull, notInArray, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { announcementReads, announcements } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    // Fetch read announcement IDs for this user
    const readRows = await db
      .select({ announcementId: announcementReads.announcementId })
      .from(announcementReads)
      .where(eq(announcementReads.userId, context.userId));

    const readIds = readRows.map(r => r.announcementId);

    const conditions = [
      eq(announcements.tenantId, tenantId),
      or(
        isNull(announcements.targetRole),
        eq(announcements.targetRole, context.role as any)
      ),
    ];

    if (readIds.length > 0) {
      conditions.push(notInArray(announcements.id, readIds));
    }

    const unreadList = await db
      .select()
      .from(announcements)
      .where(and(...conditions))
      .orderBy(desc(announcements.createdAt));

    return NextResponse.json({
      success: true,
      count: unreadList.length,
      data: unreadList,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
