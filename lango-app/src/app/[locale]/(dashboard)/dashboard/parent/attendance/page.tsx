import { requireServerPage } from '@/libs/api/page-guard';
import { AttendanceView } from '@/features/parent/ui/AttendanceView';

export default async function ParentAttendancePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireServerPage(locale, { allowedRoles: ['parent'] });
  return <AttendanceView />;
}
