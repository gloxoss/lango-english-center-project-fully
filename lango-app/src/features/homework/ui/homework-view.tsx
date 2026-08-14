import { HomeworkPage } from './homework-page';

export async function HomeworkView({ locale }: { locale?: string } = {}) {
  return <HomeworkPage locale={locale} />;
}
