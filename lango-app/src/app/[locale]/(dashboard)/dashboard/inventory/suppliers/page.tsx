import { requireServerPage } from '@/libs/api/page-guard';
import { SuppliersView } from '@/features/inventory/ui/suppliers-view';

export default async function InventorySuppliersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.catalog.manage' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <SuppliersView />
    </main>
  );
}
