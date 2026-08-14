import { GradeEntryView } from '@/features/academics/ui/grade-entry-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function GradeEntryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['teacher', 'school_admin', 'super_admin'] });
  return <GradeEntryView />;
}
