import { StudentAdmissionView } from '@/features/students/ui/student-admission-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AdmissionNewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <StudentAdmissionView locale={locale} />;
}
