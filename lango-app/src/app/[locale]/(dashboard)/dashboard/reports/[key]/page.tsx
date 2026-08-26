import { requireServerPage } from '@/libs/api/page-guard';
import { notFound, redirect } from 'next/navigation';
import { hasCapability } from '@/libs/api/permissions';
import { CatalogService } from '@/addons/advanced-reporting/services/catalog-service';
import { ReportWorkspaceView } from '@/addons/advanced-reporting/ui/report-workspace-view';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}) {
  const { locale, key } = await params;
  const ctx = await requireServerPage(locale, { requiredCapability: 'reports.read' });
  const report = CatalogService.getDefinitionByKey(key);

  if (!report) {
    notFound();
  }

  // Each report declares its own, often stricter, requiredPermissions (e.g.
  // the transport utilization report needs transport.report) - reports.read
  // only proves the viewer may open the catalog, not this specific report.
  if (report.requiredPermissions && report.requiredPermissions.length > 0) {
    const checks = await Promise.all(
      report.requiredPermissions.map(perm => hasCapability(ctx.userId, ctx.tenantId ?? '', ctx.role, perm)),
    );
    if (!checks.some(Boolean)) {
      redirect(`/${locale}/dashboard/reports`);
    }
  }

  return <ReportWorkspaceView report={report} />;
}
