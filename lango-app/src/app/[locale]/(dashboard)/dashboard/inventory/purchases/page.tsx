import { requireServerPage } from '@/libs/api/page-guard';
import { PurchasesView } from '@/features/inventory/ui/purchases-view';

export default async function InventoryPurchasesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.purchase.manage' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <PurchasesView locale={locale} />
    </main>
  );
}
