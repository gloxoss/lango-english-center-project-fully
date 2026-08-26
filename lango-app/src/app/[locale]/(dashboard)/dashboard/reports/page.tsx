import { requireServerPage } from '@/libs/api/page-guard';
import { getEffectivePermissions, type PermissionKey } from '@/libs/api/permissions';
import { CatalogService } from '@/addons/advanced-reporting/services/catalog-service';
import { ReportCenterView } from '@/addons/advanced-reporting/ui/report-center-view';

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await requireServerPage(locale, { requiredCapability: 'reports.read' });
  // Show only what this user can actually open - the unfiltered
  // getDefinitions() was listing every report (including e.g. transport
  // ones) regardless of the viewer's permissions, so clicking one they
  // couldn't access surfaced a confusing FORBIDDEN error instead of the
  // catalog simply not showing it.
  const effective = await getEffectivePermissions(ctx.userId, ctx.tenantId ?? '', ctx.role);
  const granted = Object.entries(effective).filter(([, ok]) => ok).map(([key]) => key as PermissionKey);
  const catalog = CatalogService.getDefinitionsForUser(granted);
  return <ReportCenterView initialCatalog={catalog} />;
}
