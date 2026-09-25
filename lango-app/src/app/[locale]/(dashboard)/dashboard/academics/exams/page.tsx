import { redirect } from 'next/navigation';
import { requireServerPage } from '@/libs/api/page-guard';

// Exam planning lives on one screen: this page's calendar and supervisor view is
// now the "calendar" tab of Exam Master (audit S-13). Kept as a redirect so old
// links and bookmarks still land there.
export default async function ExamPlanningPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  redirect(`/${locale}/dashboard/academics/assessment/exam-master?tab=calendar`);
}
