import { CampaignComposerClient } from './campaign-composer-client';

export async function CampaignComposerPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches campaign presets server-side
  return <CampaignComposerClient locale={locale} />;
}
