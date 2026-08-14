import { HomeworkSubmissionPage } from './homework-submission-page';

export async function HomeworkSubmissionView({ locale }: { locale?: string } = {}) {
  return <HomeworkSubmissionPage locale={locale} />;
}
