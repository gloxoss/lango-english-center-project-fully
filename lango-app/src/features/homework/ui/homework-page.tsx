import { HomeworkClient } from './homework-client';

export async function HomeworkPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches homework assignments server-side
  return <HomeworkClient locale={locale} />;
}
