import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import {
  documentGenerationItems,
  documentGenerationJobs,
} from '@/features/cards/models/cards-schema';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const [job] = await db.select().from(documentGenerationJobs)
      .where(and(eq(documentGenerationJobs.tenantId, tenantId), eq(documentGenerationJobs.id, id)))
      .limit(1);
    if (!job) throw new ApiError(404, 'NOT_FOUND', 'Lot introuvable.');

    const items = await db.select().from(documentGenerationItems)
      .where(and(
        eq(documentGenerationItems.tenantId, tenantId),
        eq(documentGenerationItems.jobId, job.id),
      ))
      .orderBy(desc(documentGenerationItems.id));

    return NextResponse.json({ success: true, data: { job, items } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
