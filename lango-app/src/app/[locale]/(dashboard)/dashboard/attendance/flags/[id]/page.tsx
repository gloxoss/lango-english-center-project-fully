import { AttendanceFlagDetailView } from '@/features/attendance/ui/attendance-flag-detail-view';

export default async function AttendanceFlagDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return <AttendanceFlagDetailView id={id} locale={locale} />;
}
