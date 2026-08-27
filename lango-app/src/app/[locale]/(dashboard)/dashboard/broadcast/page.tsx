import { requireServerPage } from '@/libs/api/page-guard';
import { BroadcastOverviewView } from '@/features/broadcast/ui/broadcast-overview-view';

export const metadata = {
  title: 'Diffusion & communication — SchoolOS',
  description: 'Tableau de bord de diffusion : campagnes, audiences, modèles et automations.',
};

export default async function BroadcastPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.read' });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <BroadcastOverviewView />
    </div>
  );
}
