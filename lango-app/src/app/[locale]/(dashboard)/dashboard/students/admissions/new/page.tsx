import { StudentAdmissionView } from '@/features/students/ui/student-admission-view';

export default async function AdmissionNewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <StudentAdmissionView locale={locale} />;
}
