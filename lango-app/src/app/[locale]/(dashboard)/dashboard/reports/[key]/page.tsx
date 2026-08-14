import { requireServerPage } from '@/libs/api/page-guard';
import { notFound } from 'next/navigation';
import { CatalogService } from '@/addons/advanced-reporting/services/catalog-service';
import { ReportWorkspaceView } from '@/addons/advanced-reporting/ui/report-workspace-view';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}) {
  const { locale, key } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  const report = CatalogService.getDefinitionByKey(key);

  if (!report) {
    notFound();
  }

  return <ReportWorkspaceView report={report} />;
}
