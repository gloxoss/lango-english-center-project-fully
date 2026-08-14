import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminSchoolDetailView } from '@/features/super-admin/ui/super-admin-school-detail-view';

export default async function SuperAdminSchoolDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminSchoolDetailView locale={locale} schoolId={id} />;
}
