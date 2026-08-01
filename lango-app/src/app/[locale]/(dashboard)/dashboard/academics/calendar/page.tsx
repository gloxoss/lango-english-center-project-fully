import { AcademicCalendarView } from '@/features/academics/ui/academic-calendar-view';

export default async function AcademicCalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AcademicCalendarView locale={locale} />;
}
