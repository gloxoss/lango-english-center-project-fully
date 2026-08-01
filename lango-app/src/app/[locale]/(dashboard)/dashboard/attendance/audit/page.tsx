import { AttendanceAuditView } from '@/features/attendance/ui/attendance-audit-view';

export default async function AttendanceAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AttendanceAuditView locale={locale} />;
}
