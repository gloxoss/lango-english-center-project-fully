import { ExamPlanningClient } from './exam-planning-client';

export async function ExamPlanningPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches exam planning sessions server-side
  return <ExamPlanningClient locale={locale} />;
}
