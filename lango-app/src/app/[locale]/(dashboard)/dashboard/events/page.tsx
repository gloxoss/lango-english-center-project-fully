import { requireServerPage } from '@/libs/api/page-guard';
import { EventsCalendarView } from '@/features/events/ui/events-calendar-view';

export default async function EventsCalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <EventsCalendarView locale={locale} />;
}
