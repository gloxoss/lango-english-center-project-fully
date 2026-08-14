import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminDashboardView } from '@/features/super-admin/ui/super-admin-dashboard-view';

export default async function SuperAdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminDashboardView locale={locale} />;
}
