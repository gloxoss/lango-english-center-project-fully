import { requireServerPage } from '@/libs/api/page-guard';
import { CampaignComposerView } from '@/features/crm/ui/campaign-composer-view';

export default async function CampaignComposerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  return <CampaignComposerView locale={locale} />;
}
