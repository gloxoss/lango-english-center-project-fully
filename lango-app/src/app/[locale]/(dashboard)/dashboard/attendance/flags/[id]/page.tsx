import { AttendanceFlagDetailView } from '@/features/attendance/ui/attendance-flag-detail-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AttendanceFlagDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AttendanceFlagDetailView id={id} locale={locale} />;
}
