import { AttendanceExcusesView } from '@/features/attendance/ui/attendance-excuses-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AttendanceExcusesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'attendance.manage' });
  return <AttendanceExcusesView locale={locale} />;
}
