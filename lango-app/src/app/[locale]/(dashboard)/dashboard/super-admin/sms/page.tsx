import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminSmsView } from '@/features/super-admin/ui/super-admin-sms-view';

export default async function SuperAdminSmsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminSmsView />;
}
