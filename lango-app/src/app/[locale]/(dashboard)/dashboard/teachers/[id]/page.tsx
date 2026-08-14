import { requireServerPage } from '@/libs/api/page-guard';
import { TeacherProfile360View } from '@/features/academics/ui/teacher-profile-view';

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <TeacherProfile360View id={id} locale={locale} />;
}
