import { requireServerPage } from '@/libs/api/page-guard';
import { CampaignDetailView } from '@/features/broadcast/ui/campaign-detail-view';

export const metadata = {
  title: 'Détail de campagne — SchoolOS',
  description: 'Suivi d’une campagne de diffusion : destinataires, envois et rapport.',
};

export default async function BroadcastCampaignDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale} className="mx-auto max-w-7xl px-4 py-8">
      <CampaignDetailView campaignId={id} />
    </main>
  );
}
