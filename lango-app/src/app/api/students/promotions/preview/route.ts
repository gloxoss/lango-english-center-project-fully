import { and, avg, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import { assessmentResults, assessments, assessmentPlans, user } from '@/models/Schema';

function recommend(avgPct: number | null, passThresholdPct: number): 'promote' | 'retain' | 'defer' {
  if (avgPct === null) return 'defer'; // no grades recorded yet
  if (avgPct >= passThresholdPct) return 'promote';
  return 'retain';
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'students.placements.manage');

    const { searchParams } = new URL(req.url);
    const sourceSectionId = searchParams.get('sourceSectionId');
    const targetSectionId = searchParams.get('targetSectionId');

    if (!sourceSectionId) {
      throw new ApiError(400, 'MISSING_PARAM', 'sourceSectionId requis.');
    }

    // Configurable pass threshold: academic.passThreshold is expressed on the
    // school's grading scale (default 10/20); assessmentResults.finalPercentage
    // is always a 0-100 percentage, so normalize before comparing.
    const [{ value: passThresholdValue }, { value: gradingScaleValue }] = await Promise.all([
      getEffectiveValueWithLegacyFallback(tenantId, null, 'academic.passThreshold'),
      getEffectiveValueWithLegacyFallback(tenantId, null, 'academic.gradingScale'),
    ]);
    const gradingScale = gradingScaleValue === '100' ? '100' : '20';
    const passThresholdRaw = Number(passThresholdValue) || 10;
    const passThresholdPct = gradingScale === '20' ? passThresholdRaw * 5 : passThresholdRaw;

    // All active students in the source section
    const students = await db
      .select({
        id: user.id,
        name: user.name,
        matricule: user.matricule,
        userStatus: user.userStatus,
      })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        eq(user.classSectionId, sourceSectionId),
      ));

    if (students.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { sourceSectionId, targetSectionId, passThreshold: passThresholdPct, gradingScale, passThresholdRaw, total: 0 },
      });
    }

    const studentIds = students.map(s => s.id);

    // Average finalPercentage per student across all assessments scoped to this tenant
    // ponytail: one aggregation query instead of N+1 per student
    const gradeRows = await db
      .select({
        studentId: assessmentResults.studentId,
        avgPct: avg(assessmentResults.finalPercentage),
      })
      .from(assessmentResults)
      .innerJoin(assessments, eq(assessmentResults.assessmentId, assessments.id))
      .innerJoin(assessmentPlans, eq(assessments.assessmentPlanId, assessmentPlans.id))
      .where(and(
        eq(assessmentResults.tenantId, tenantId),
      ))
      .groupBy(assessmentResults.studentId);

    // Build map for O(1) lookup
    const gradeMap = new Map(
      gradeRows
        .filter(r => studentIds.includes(r.studentId))
        .map(r => [r.studentId, r.avgPct !== null ? Number(r.avgPct) : null]),
    );

    const preview = students.map(s => {
      const avgPct = gradeMap.get(s.id) ?? null;
      return {
        studentId: s.id,
        studentName: s.name,
        matricule: s.matricule,
        averagePercentage: avgPct !== null ? Math.round(avgPct * 100) / 100 : null,
        recommendation: recommend(avgPct, passThresholdPct),
        currentStatus: s.userStatus,
      };
    });

    // Sort: promote first, retain second, defer last
    const order = { promote: 0, retain: 1, defer: 2 } as const;
    preview.sort((a, b) => order[a.recommendation] - order[b.recommendation]);

    return NextResponse.json({
      success: true,
      data: preview,
      meta: {
        sourceSectionId,
        targetSectionId: targetSectionId ?? null,
        passThreshold: passThresholdPct,
        gradingScale,
        passThresholdRaw,
        total: preview.length,
        toPromote: preview.filter(p => p.recommendation === 'promote').length,
        toRetain: preview.filter(p => p.recommendation === 'retain').length,
        toDefer: preview.filter(p => p.recommendation === 'defer').length,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
