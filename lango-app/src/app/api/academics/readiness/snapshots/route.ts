import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { computeReadiness } from '@/libs/services/academic-readiness';
import { academicReadinessSnapshots, sessionYears } from '@/models/Schema';

const snapshotSchema = z.object({
  sessionYearId: z.string().uuid({ message: 'L\'identifiant de la session est requis.' }).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'academics.manage');

    const body = await parseJson(request, snapshotSchema);

    let targetSessionId = body.sessionYearId ?? null;
    if (!targetSessionId) {
      const [defaultSession] = await db
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      targetSessionId = defaultSession?.id ?? null;
    }

    if (!targetSessionId) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Aucune session académique par défaut n\'est définie.');
    }

    const readiness = await computeReadiness(tenantId, targetSessionId);

    const [snapshot] = await db
      .insert(academicReadinessSnapshots)
      .values({
        tenantId,
        sessionYearId: targetSessionId,
        overallScore: readiness.overallScore,
      })
      .returning();

    if (!snapshot) {
      throw new ApiError(500, 'INSERT_FAILED', 'L\'instantané n\'a pas pu être créé.');
    }

    recordAudit(ctx, 'create', 'academic_readiness_snapshot', snapshot.id, {
      sessionYearId: targetSessionId,
      overallScore: snapshot.overallScore,
    });

    return NextResponse.json({
      success: true,
      data: snapshot,
      message: `Instantané capturé — score ${snapshot.overallScore}/100.`,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
