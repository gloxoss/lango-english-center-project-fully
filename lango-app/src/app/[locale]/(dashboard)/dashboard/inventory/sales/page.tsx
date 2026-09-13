import { requireServerPage } from '@/libs/api/page-guard';
import { SalesView } from '@/features/inventory/ui/sales-view';

export default async function InventorySalesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.sell' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <SalesView locale={locale} />
    </main>
  );
}
