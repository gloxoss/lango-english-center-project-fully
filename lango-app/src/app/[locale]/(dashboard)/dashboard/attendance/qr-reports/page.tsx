import { QrReportsView } from '@/features/attendance/ui/qr-reports-view';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Rapports & Audit QR — SchoolOS',
  description: 'Journal d’audit des scans QR, terminaux appairés et sessions de scan.',
};

export default async function QrReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8">
      <QrReportsView />
    </div>
  );
}
