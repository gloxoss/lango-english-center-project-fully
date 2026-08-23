import { requireServerPage } from '@/libs/api/page-guard';
import { TeacherAdminDetailView } from '@/features/teachers/ui/teacher-admin-detail-view';

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <TeacherAdminDetailView id={id} locale={locale} />;
}
