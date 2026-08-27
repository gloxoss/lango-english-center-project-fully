import { requireServerPage } from '@/libs/api/page-guard';
import { CampaignsView } from '@/features/broadcast/ui/campaigns-view';

export const metadata = {
  title: 'Campagnes de diffusion — SchoolOS',
  description: 'Composez, prévisualisez et lancez vos campagnes de diffusion.',
};

export default async function BroadcastCampaignsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.manage' });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <CampaignsView />
    </div>
  );
}
