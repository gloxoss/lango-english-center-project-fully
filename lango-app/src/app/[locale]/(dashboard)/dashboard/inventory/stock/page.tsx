import { requireServerPage } from '@/libs/api/page-guard';
import { StockView } from '@/features/inventory/ui/stock-view';

export default async function InventoryStockPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.read' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <StockView locale={locale} />
    </main>
  );
}
