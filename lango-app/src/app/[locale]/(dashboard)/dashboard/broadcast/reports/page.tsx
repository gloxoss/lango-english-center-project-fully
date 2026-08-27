import { requireServerPage } from '@/libs/api/page-guard';
import { ReportsView } from '@/features/broadcast/ui/reports-view';

export const metadata = {
  title: 'Rapports de diffusion — SchoolOS',
  description: 'Statistiques d’envoi et de délivrabilité par campagne.',
};

export default async function BroadcastReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.read' });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <ReportsView />
    </div>
  );
}
