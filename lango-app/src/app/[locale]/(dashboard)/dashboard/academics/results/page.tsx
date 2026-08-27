import { ClassResultsView } from '@/features/academics/ui/class-results-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ClassResultsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'grading.read' });
  return <ClassResultsView />;
}
