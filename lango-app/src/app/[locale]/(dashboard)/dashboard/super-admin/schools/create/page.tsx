import { SuperAdminSchoolsCreateView } from '@/features/super-admin/ui/super-admin-schools-create-view';

export default async function SuperAdminSchoolsCreatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SuperAdminSchoolsCreateView locale={locale} />;
}
