import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminSchoolsView } from '@/features/super-admin/ui/super-admin-schools-view';

export default async function SuperAdminSchoolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminSchoolsView locale={locale} />;
}
