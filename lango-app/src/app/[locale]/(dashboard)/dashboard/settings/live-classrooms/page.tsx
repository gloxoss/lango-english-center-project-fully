import { requireServerPage } from '@/libs/api/page-guard';
import { requireLivePage } from '@/features/live-classrooms/ui/page-guard';
import { ProvidersSettingsClient } from '@/features/live-classrooms/ui/providers-settings-client';

export default async function LiveClassroomsSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  await requireLivePage(locale, {
    allowedRoles: ['school_admin', 'super_admin'],
    requiredCapability: 'live.providers.manage',
  });
  return <ProvidersSettingsClient />;
}
