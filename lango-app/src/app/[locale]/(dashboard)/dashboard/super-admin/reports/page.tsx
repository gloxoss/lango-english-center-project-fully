import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminReportsView } from '@/features/super-admin/ui/super-admin-reports-view';

export default async function SuperAdminReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminReportsView />;
}
