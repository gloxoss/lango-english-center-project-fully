import { AttendanceScannerPlayground } from '@/features/attendance/ui/attendance-scanner-playground';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Kiosque Scanner QR — SchoolOS',
  description: 'Borne de scan des badges QR pour la présence des élèves.',
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'attendance.manage' });
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AttendanceScannerPlayground locale={locale} />
    </div>
  );
}
