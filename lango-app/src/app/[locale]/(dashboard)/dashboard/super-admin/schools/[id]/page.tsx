import { SuperAdminSchoolDetailView } from '@/features/super-admin/ui/super-admin-school-detail-view';

export default async function SuperAdminSchoolDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return <SuperAdminSchoolDetailView locale={locale} schoolId={id} />;
}
