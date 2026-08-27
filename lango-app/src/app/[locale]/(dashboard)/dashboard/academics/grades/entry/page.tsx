import { GradeEntryView } from '@/features/academics/ui/grade-entry-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function GradeEntryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'grading.read' });
  return <GradeEntryView />;
}
