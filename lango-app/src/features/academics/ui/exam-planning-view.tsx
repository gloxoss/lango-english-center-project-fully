import { ExamPlanningPage } from './exam-planning-page';

export async function ExamPlanningView({ locale }: { locale?: string } = {}) {
  return <ExamPlanningPage locale={locale} />;
}
