import { ExamPlanningView } from '@/features/academics/ui/exam-planning-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ExamPlanningPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  return <ExamPlanningView locale={locale} />;
}
