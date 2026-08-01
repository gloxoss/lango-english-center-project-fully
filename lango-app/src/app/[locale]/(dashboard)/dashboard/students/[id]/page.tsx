import { StudentProfile360View } from '@/features/students/ui/student-profile-view';

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return <StudentProfile360View id={id} locale={locale} />;
}
