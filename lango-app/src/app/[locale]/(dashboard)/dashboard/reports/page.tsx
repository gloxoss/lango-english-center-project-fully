import { requireServerPage } from '@/libs/api/page-guard';
import { CatalogService } from '@/addons/advanced-reporting/services/catalog-service';
import { ReportCenterView } from '@/addons/advanced-reporting/ui/report-center-view';

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  const catalog = CatalogService.getDefinitions();
  return <ReportCenterView initialCatalog={catalog} />;
}
