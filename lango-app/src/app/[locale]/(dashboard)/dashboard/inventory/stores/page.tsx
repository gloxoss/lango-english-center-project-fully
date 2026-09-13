import { requireServerPage } from '@/libs/api/page-guard';
import { StoresView } from '@/features/inventory/ui/stores-view';

export default async function InventoryStoresPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.catalog.manage' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <StoresView />
    </main>
  );
}
