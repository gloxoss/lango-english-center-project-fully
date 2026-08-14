import { requireServerPage } from '@/libs/api/page-guard';
import { CampaignDetailView } from '@/features/broadcast/ui/campaign-detail-view';

export const metadata = {
  title: 'Détail de campagne — SchoolOS',
  description: 'Suivi d’une campagne de diffusion : destinataires, envois et rapport.',
};

export default async function BroadcastCampaignDetailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <CampaignDetailView />
    </div>
  );
}
