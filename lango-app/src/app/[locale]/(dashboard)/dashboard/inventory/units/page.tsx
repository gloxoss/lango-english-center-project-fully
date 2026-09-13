import { requireServerPage } from '@/libs/api/page-guard';
import { UnitsView } from '@/features/inventory/ui/units-view';

export default async function InventoryUnitsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.catalog.manage' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <UnitsView />
    </main>
  );
}
