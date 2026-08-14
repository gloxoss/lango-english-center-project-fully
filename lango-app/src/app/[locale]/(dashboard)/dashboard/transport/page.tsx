import { requireTransportPage } from '@/features/transport/ui/page-guard';
import { TransportOverviewView } from '@/features/transport/ui/transport-overview-view';

export default async function TransportOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireTransportPage(locale, {
    allowedRoles: ['school_admin', 'super_admin', 'teacher', 'receptionist', 'guard'],
    requiredCapability: 'transport.read',
  });
  return <TransportOverviewView />;
}
