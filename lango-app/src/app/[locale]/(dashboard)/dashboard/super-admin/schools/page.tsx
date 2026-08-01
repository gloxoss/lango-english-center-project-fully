import { SuperAdminSchoolsView } from '@/features/super-admin/ui/super-admin-schools-view';

export default async function SuperAdminSchoolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SuperAdminSchoolsView locale={locale} />;
}
