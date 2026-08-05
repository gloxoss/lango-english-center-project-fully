import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    await requireCapability(context, 'academics.read');
    const tenantId = requireTenant(context);

    // Fetch metrics from internal GET handler logic or endpoint
    const url = new URL(request.url);
    const origin = url.origin;
    const res = await fetch(`${origin}/api/academics/readiness`, {
      headers: { cookie: request.headers.get('cookie') || '' },
    });
    const json = await res.json();

    const data = json.data || {};
    const overallScore = data.overallScore ?? 0;
    const checks = data.checks || [];

    let csvContent = `Rapport de Bilan de Rentree Academique\n`;
    csvContent += `Score Global de Preparation,${overallScore}%\n\n`;
    csvContent += `Controle,Score (%),Statut,Detail\n`;

    for (const c of checks) {
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
