import { HomeworkSubmissionClient } from './homework-submission-client';

export async function HomeworkSubmissionPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches student submissions server-side
  return <HomeworkSubmissionClient locale={locale} />;
}
