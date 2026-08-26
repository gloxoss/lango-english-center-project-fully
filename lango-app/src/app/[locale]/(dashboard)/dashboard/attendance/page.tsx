import { AttendanceView } from '@/features/attendance/ui/attendance-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'attendance.read' });
  return <AttendanceView />;
}
