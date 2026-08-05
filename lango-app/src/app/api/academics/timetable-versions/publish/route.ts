import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { findVersionConflicts } from '@/libs/services/timetable-validation';
import { timetableVersions } from '@/models/Schema';

export const publishVersionSchema = z.object({
  versionId: z.string().uuid({ message: 'L\'identifiant de la version est requis.' }),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, publishVersionSchema);

    // Verify draft version exists and belongs to tenant
    const [targetVersion] = await db
      .select()
      .from(timetableVersions)
      .where(and(eq(timetableVersions.id, body.versionId), eq(timetableVersions.tenantId, tenantId)))
      .limit(1);

    if (!targetVersion) {
      throw new ApiError(404, 'NOT_FOUND', 'La version de l\'emploi du temps demandée est introuvable.');
    }

    if (targetVersion.status === 'published') {
      throw new ApiError(409, 'ALREADY_PUBLISHED', 'Cette version est déjà publiée.');
    }

    // Run conflict scan across all slots in this version
    const conflicts = await findVersionConflicts(tenantId, body.versionId);

    if (conflicts.length > 0) {
      throw new ApiError(
        409,
        'TIMETABLE_CONFLICTS_FOUND',
        `Publication impossible : ${conflicts.length} conflit(s) détecté(s) dans cette version.`,
      );
    }

    // Atomic publishing: Archive previous published version and publish target
    const published = await db.transaction(async (tx) => {
      // Archive current published version for same session year
      await tx
        .update(timetableVersions)
        .set({ status: 'archived', updatedAt: new Date().toISOString() })
        .where(and(
          eq(timetableVersions.tenantId, tenantId),
          eq(timetableVersions.sessionYearId, targetVersion.sessionYearId),
          eq(timetableVersions.status, 'published'),
        ));

      // Publish target version
      const [updated] = await tx
        .update(timetableVersions)
        .set({
          status: 'published',
          publishedBy: context.userId,
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(timetableVersions.id, body.versionId), eq(timetableVersions.tenantId, tenantId)))
        .returning();

      recordAudit(context, 'update', 'timetable_version_published', body.versionId);

      return updated!;
    });

    return NextResponse.json({ success: true, data: published });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
