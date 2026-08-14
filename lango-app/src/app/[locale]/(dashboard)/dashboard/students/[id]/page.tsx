import { StudentDetailView } from '@/features/students/ui/student-detail-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <StudentDetailView id={id} locale={locale} />;
}
