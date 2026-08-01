import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { announcements } from '@/models/Schema';

const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1),
  targetRole: z.enum(['super_admin', 'school_admin', 'teacher', 'accountant', 'student', 'parent', 'receptionist', 'guard']).optional(),
  targetClassSectionId: z.string().uuid().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    // Fetch announcements targeted to viewer's role (or null/everyone)
    const list = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.tenantId, tenantId),
          or(
            isNull(announcements.targetRole),
            eq(announcements.targetRole, context.role as any)
          )
        )
      )
      .orderBy(desc(announcements.createdAt));

    return NextResponse.json({
      success: true,
      data: list,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, createAnnouncementSchema);

    const [item] = await db
      .insert(announcements)
      .values({
        tenantId,
        title: body.title,
        body: body.body,
        targetRole: body.targetRole || null,
        targetClassSectionId: body.targetClassSectionId || null,
        createdById: context.userId,
      })
      .returning();

    if (item) {
      await recordAudit(context, 'create', 'announcement', item.id);
    }

    return NextResponse.json({
      success: true,
      data: item,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
