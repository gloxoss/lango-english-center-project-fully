import { AttendanceFlagsView } from '@/features/attendance/ui/attendance-flags-view';

export default async function AttendanceFlagsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AttendanceFlagsView locale={locale} />;
}
