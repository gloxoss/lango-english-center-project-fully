import { requireServerPage } from '@/libs/api/page-guard';
import { EntitlementsCatalogView } from '@/features/settings/ui/entitlements-catalog-view';

export default async function EntitlementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.read' });
  return <EntitlementsCatalogView locale={locale} />;
}
