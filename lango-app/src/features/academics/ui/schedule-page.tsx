import { ScheduleClient } from './schedule-client';

export async function SchedulePage({ locale }: { locale?: string } = {}) {
  return <ScheduleClient locale={locale} />;
}
