import { requireServerPage } from '@/libs/api/page-guard';
import { CampaignComposerView } from '@/features/crm/ui/campaign-composer-view';

export default async function CampaignComposerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <CampaignComposerView locale={locale} />
    </main>
  );
}
