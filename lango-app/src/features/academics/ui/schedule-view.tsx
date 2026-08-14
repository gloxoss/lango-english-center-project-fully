import { SchedulePage } from './schedule-page';

export async function ScheduleView({ locale }: { locale?: string } = {}) {
  return <SchedulePage locale={locale} />;
}

export { ScheduleView as ScheduleInteractiveView };
