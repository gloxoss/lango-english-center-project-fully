import { StudentAdmissionView } from '@/features/students/ui/student-admission-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AddStudentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'students.create' });
  return <StudentAdmissionView locale={locale} />;
}
