import { AttendanceExcusesView } from '@/features/attendance/ui/attendance-excuses-view';

export default async function AttendanceExcusesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AttendanceExcusesView locale={locale} />;
}
