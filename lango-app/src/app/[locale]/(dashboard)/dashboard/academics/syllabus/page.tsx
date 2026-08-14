import { SyllabusView } from '@/features/academics/ui/syllabus-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function SyllabusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <SyllabusView />;
}
