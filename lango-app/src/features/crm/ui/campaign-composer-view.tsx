import { CampaignComposerPage } from './campaign-composer-page';

export async function CampaignComposerView({ locale }: { locale?: string } = {}) {
  return <CampaignComposerPage locale={locale} />;
}
