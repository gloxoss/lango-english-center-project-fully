import { requireServerPage } from '@/libs/api/page-guard';
import { AttendanceSettingsView } from '@/features/settings/ui/attendance-settings-view';

export default async function AttendanceSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.attendance.manage' });
  return <AttendanceSettingsView />;
}
