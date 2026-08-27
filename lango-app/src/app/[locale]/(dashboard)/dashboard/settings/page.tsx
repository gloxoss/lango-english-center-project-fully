import { requireServerPage } from '@/libs/api/page-guard';
import { SettingsView } from '@/features/settings/ui/settings-view';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.organization.manage' });
  return <SettingsView locale={locale} />;
}
