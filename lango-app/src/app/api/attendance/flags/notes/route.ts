import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { attendanceFlagNotes, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const flagId = searchParams.get('flagId');
    if (!flagId) {
      return NextResponse.json({ success: false, message: 'flagId requis' }, { status: 400 });
    }

    const rows = await db
      .select({
        id: attendanceFlagNotes.id,
        body: attendanceFlagNotes.body,
        createdAt: attendanceFlagNotes.createdAt,
        authorName: user.name,
      })
      .from(attendanceFlagNotes)
      .innerJoin(user, eq(attendanceFlagNotes.authorId, user.id))
      .where(and(eq(attendanceFlagNotes.tenantId, tenantId), eq(attendanceFlagNotes.flagId, flagId)))
      .orderBy(desc(attendanceFlagNotes.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const createNoteSchema = z.object({
  flagId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const body = await parseJson(request, createNoteSchema);

    const [inserted] = await db
      .insert(attendanceFlagNotes)
      .values({ tenantId, flagId: body.flagId, authorId: context.userId, body: body.body })
      .returning();

    return NextResponse.json({ success: true, data: inserted, message: 'Note ajoutée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
