import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { computeReadiness } from '@/libs/services/academic-readiness';
import { sessionYears } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    await requireCapability(context, 'academics.read');
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    let targetSessionId = searchParams.get('sessionYearId');
    if (!targetSessionId) {
      const [defaultSession] = await db
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      targetSessionId = defaultSession?.id ?? null;
    }

    const readiness = targetSessionId ? await computeReadiness(tenantId, targetSessionId) : { overallScore: 0, checks: [] };

    let csvContent = `Rapport de Bilan de Rentree Academique\n`;
    csvContent += `Score Global de Preparation,${readiness.overallScore}%\n\n`;
    csvContent += `Controle,Score (%),Statut,Detail\n`;

    for (const c of readiness.checks) {
      csvContent += `"${c.title}",${c.score}%,${c.status},"${c.detail}"\n`;
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bilan-rentree-academique.csv"',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
