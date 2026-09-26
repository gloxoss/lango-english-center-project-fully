import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { generateMassarMarksheet } from '@/features/academics/services/massar-sync-service';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { classSubjects, classes } from '@/models/Schema';
import { db } from '@/libs/DB';

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(ctx);

    const { searchParams } = new URL(request.url);
    const assessmentDefId = searchParams.get('assessmentDefId');

    if (!assessmentDefId) {
      return NextResponse.json({ success: false, message: 'assessmentDefId requis.' }, { status: 400 });
    }

    // Campus lock: the marksheet's campus is the class behind the definition.
    const [campus] = await db
      .select({ branchId: classes.branchId })
      .from(assessmentDefinitions)
      .leftJoin(classSubjects, eq(assessmentDefinitions.classSubjectId, classSubjects.id))
      .leftJoin(classes, eq(classSubjects.classId, classes.id))
      .where(and(eq(assessmentDefinitions.id, assessmentDefId), eq(assessmentDefinitions.tenantId, tenantId)))
      .limit(1);
    assertBranchScope(ctx, campus?.branchId ?? null);

    const { buffer, filename } = await generateMassarMarksheet(tenantId, assessmentDefId);

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
