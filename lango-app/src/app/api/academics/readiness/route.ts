import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { computeReadiness } from '@/libs/services/academic-readiness';
import { academicReadinessSnapshots, sessionYears } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    await requireCapability(context, 'academics.read');
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const sessionYearIdParam = searchParams.get('sessionYearId');

    let targetSessionId = sessionYearIdParam;
    if (!targetSessionId) {
      const [defaultSession] = await db
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      targetSessionId = defaultSession?.id ?? null;
    }

    if (!targetSessionId) {
      return NextResponse.json({
        success: true,
        data: {
          overallScore: 0,
          checks: [],
          trend: [],
          weeklyTrendDelta: null,
        },
      });
    }

    const readiness = await computeReadiness(tenantId, targetSessionId);

    // Historical trend: last ~8 captured snapshots, oldest → newest.
    const snapshotRows = await db
      .select({ overallScore: academicReadinessSnapshots.overallScore, capturedAt: academicReadinessSnapshots.capturedAt })
      .from(academicReadinessSnapshots)
      .where(and(
        eq(academicReadinessSnapshots.tenantId, tenantId),
        eq(academicReadinessSnapshots.sessionYearId, targetSessionId),
      ))
      .orderBy(desc(academicReadinessSnapshots.capturedAt))
      .limit(8);

    snapshotRows.reverse();
    const trend = snapshotRows.map(s => ({
      score: s.overallScore,
      capturedAt: s.capturedAt,
    }));

    const lastPoint = trend[trend.length - 1];
    const prevPoint = trend[trend.length - 2];
    const weeklyTrendDelta = lastPoint && prevPoint ? lastPoint.score - prevPoint.score : null;

    return NextResponse.json({
      success: true,
      data: {
        sessionYearId: readiness.sessionYearId,
        overallScore: readiness.overallScore,
        checks: readiness.checks,
        trend,
        weeklyTrendDelta,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
