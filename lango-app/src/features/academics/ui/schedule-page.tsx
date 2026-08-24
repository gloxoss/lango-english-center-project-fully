import { SchedulePlayground } from './schedule-playground';

export async function SchedulePage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches schedule slots server-side
  return <SchedulePlayground locale={locale} />;
}
