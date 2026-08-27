import { TonightView } from '@/features/hostel/ui/tonight-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.read' });
  return <TonightView />;
}
