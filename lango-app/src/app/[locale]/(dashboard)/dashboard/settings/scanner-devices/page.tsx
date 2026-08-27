import { requireServerPage } from '@/libs/api/page-guard';
import { ScannerDevicesView } from '@/features/attendance/ui/scanner-devices-view';

export default async function ScannerDevicesSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.attendance.manage' });
  return <ScannerDevicesView />;
}
