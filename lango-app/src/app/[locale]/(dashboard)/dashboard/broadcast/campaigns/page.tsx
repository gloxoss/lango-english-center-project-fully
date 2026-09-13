import { requireServerPage } from '@/libs/api/page-guard';
import { CampaignsView } from '@/features/broadcast/ui/campaigns-view';

export const metadata = {
  title: 'Campagnes de diffusion — SchoolOS',
  description: 'Création, prévisualisation et suivi des campagnes d’envois groupés.',
};

export default async function BroadcastCampaignsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale} className="mx-auto max-w-7xl px-4 py-8">
      <CampaignsView />
    </main>
  );
}
