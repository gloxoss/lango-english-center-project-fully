import { TeacherProfile360View } from '@/features/academics/ui/teacher-profile-view';

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return <TeacherProfile360View id={id} locale={locale} />;
}
