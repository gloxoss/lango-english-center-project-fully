import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminSupportView } from '@/features/super-admin/ui/super-admin-support-view';

export default async function SuperAdminSupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminSupportView />;
}
