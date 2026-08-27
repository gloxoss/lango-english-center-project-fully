import { requireServerPage } from '@/libs/api/page-guard';
import SettingsValuesPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.organization.manage' });
  return <SettingsValuesPage />;
}
