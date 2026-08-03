import { EntitlementsCatalogView } from '@/features/settings/ui/entitlements-catalog-view';

export default async function EntitlementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <EntitlementsCatalogView locale={locale} />;
}
