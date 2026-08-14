import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminSettingsView } from '@/features/super-admin/ui/super-admin-settings-view';

export default async function SuperAdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminSettingsView />;
}
