import { AttendanceFlagsView } from '@/features/attendance/ui/attendance-flags-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AttendanceFlagsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AttendanceFlagsView locale={locale} />;
}
