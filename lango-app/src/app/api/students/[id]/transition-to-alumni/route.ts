import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { transitionStudentToAlumni } from '@/libs/services/alumni-transition';

type RouteParams = { params: Promise<{ id: string }> };

const transitionSchema = z.object({ graduationCohortSessionYearId: z.string().uuid().optional() }).strict();

// Real graduation transition, single student (future-implementation/alumni-portal).
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const { id: studentId } = await params;
    const body = await parseJson(req, transitionSchema);

    const result = await db.transaction(tx =>
      transitionStudentToAlumni(tx, tenantId, studentId, context.userId, body.graduationCohortSessionYearId),
    );

    recordAudit(context, 'update', 'student_alumni_transition', studentId, { action: 'transition' });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Élève transitionné vers le statut Ancien(ne) élève avec succès.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
