import { SuperAdminDashboardView } from '@/features/super-admin/ui/super-admin-dashboard-view';

export default async function SuperAdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SuperAdminDashboardView locale={locale} />;
}
