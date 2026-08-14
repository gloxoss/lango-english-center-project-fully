import { AcademicCalendarView } from '@/features/academics/ui/academic-calendar-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AcademicCalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AcademicCalendarView locale={locale} />;
}
