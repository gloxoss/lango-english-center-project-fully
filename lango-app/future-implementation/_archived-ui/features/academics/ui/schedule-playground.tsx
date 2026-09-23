'use client';

import { ScheduleClient } from './schedule-client';

export function SchedulePlayground({ locale = 'fr' }: { locale?: string }) {
  return <ScheduleClient locale={locale} />;
}
