import { EventsCalendarPage } from './events-calendar-page';

export async function EventsCalendarView({ locale }: { locale?: string } = {}) {
  return <EventsCalendarPage locale={locale} />;
}
