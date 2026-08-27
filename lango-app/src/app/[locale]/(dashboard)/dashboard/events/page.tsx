import { requireServerPage } from '@/libs/api/page-guard';
import { EventsCalendarView } from '@/features/events/ui/events-calendar-view';

export default async function EventsCalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'events.read' });
  return <EventsCalendarView locale={locale} />;
}
