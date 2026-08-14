import { AttendanceAuditView } from '@/features/attendance/ui/attendance-audit-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AttendanceAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AttendanceAuditView locale={locale} />;
}
