import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminSchoolsView } from '@/features/super-admin/ui/super-admin-schools-view';

export default async function SuperAdminSchoolsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminSchoolsView locale={locale} initialStatus={status} />;
}
