import { requireServerPage } from '@/libs/api/page-guard';
import { requireLivePage } from '@/features/live-classrooms/ui/page-guard';
import { ProvidersSettingsClient } from '@/features/live-classrooms/ui/providers-settings-client';

export default async function LiveClassroomsSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'live.providers.manage' });
  await requireLivePage(locale, { requiredCapability: 'live.providers.manage' });
  return <ProvidersSettingsClient />;
}
