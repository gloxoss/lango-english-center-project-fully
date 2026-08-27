import { requireServerPage } from '@/libs/api/page-guard';
import { ThemeSettingsView } from '@/features/website/ui/theme-settings-view';

export default async function WebsiteThemeSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'website.read' });
  return <ThemeSettingsView />;
}
