import { EventsCalendarClient } from './events-calendar-client';

export async function EventsCalendarPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches upcoming events server-side
  return <EventsCalendarClient locale={locale} />;
}
