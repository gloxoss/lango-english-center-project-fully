import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { transitionStudentToAlumni } from '@/libs/services/alumni-transition';

const bulkTransitionSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1).max(200),
  graduationCohortSessionYearId: z.string().uuid().optional(),
}).strict();

type ItemResult =
  | { studentId: string; success: true; tempPassword: string | null; loginAccessDeliveryStatus: string | null }
  | { studentId: string; success: false; error: string };

// Real bulk transition for a whole graduating cohort at once (Phase 4
// refinement, future-implementation/alumni-portal) - reuses the exact
// same per-student transaction as the single-student route, each one
// independent so one student's failure never blocks the others.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const body = await parseJson(request, bulkTransitionSchema);

    const results: ItemResult[] = [];

    for (const studentId of body.studentIds) {
      try {
        const result = await db.transaction(tx =>
          transitionStudentToAlumni(tx, tenantId, studentId, context.userId, body.graduationCohortSessionYearId),
        );
        results.push({ studentId, success: true, tempPassword: result.tempPassword, loginAccessDeliveryStatus: result.loginAccessDeliveryStatus });
      } catch (err) {
        results.push({ studentId, success: false, error: err instanceof Error ? err.message : 'Échec du transfert.' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;

    recordAudit(context, 'update', 'student_alumni_bulk_transition', body.studentIds.join(','), { successCount, errorCount });

    return NextResponse.json({
      success: true,
      successCount,
      errorCount,
      results,
      message: `${successCount} élève(s) transitionné(s)${errorCount > 0 ? `, ${errorCount} en erreur` : ''}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
