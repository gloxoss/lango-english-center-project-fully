import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminSchoolsCreateView } from '@/features/super-admin/ui/super-admin-schools-create-view';

export default async function SuperAdminSchoolsCreatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminSchoolsCreateView locale={locale} />;
}
