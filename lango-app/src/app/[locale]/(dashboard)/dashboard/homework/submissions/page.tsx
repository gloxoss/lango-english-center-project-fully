import { requireServerPage } from '@/libs/api/page-guard';
import { HomeworkSubmissionView } from '@/features/homework/ui/homework-submission-view';

// Teacher grading workspace — see dashboard/homework/page.tsx for why this
// must stay teacher/school_admin/super_admin-only (no student view exists).
export default async function HomeworkSubmissionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'grading.manage' });
  return <HomeworkSubmissionView locale={locale} />;
}
