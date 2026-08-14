import { ScheduleClient } from './schedule-client';

export async function SchedulePage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches schedule slots server-side
  return <ScheduleClient locale={locale} />;
}
