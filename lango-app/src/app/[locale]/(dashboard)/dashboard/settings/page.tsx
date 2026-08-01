import { SettingsView } from '@/features/settings/ui/settings-view';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SettingsView locale={locale} />;
}
