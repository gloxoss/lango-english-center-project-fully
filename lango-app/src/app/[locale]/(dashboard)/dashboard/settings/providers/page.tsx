import { requireServerPage } from '@/libs/api/page-guard';
import { ProvidersView } from '@/features/settings/ui/providers-view';

export default async function ProvidersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.integrations.manage' });
  return <ProvidersView locale={locale} />;
}
