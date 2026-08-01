import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { announcementReads } from '@/models/Schema';

const markReadSchema = z.object({
  announcementId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, markReadSchema);

    await db
      .insert(announcementReads)
      .values({
        announcementId: body.announcementId,
        userId: context.userId,
      })
      .onConflictDoNothing();

    return NextResponse.json({
      success: true,
      message: 'Annonce marquée comme lue.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
