import { requireServerPage } from '@/libs/api/page-guard';
import { ProductsView } from '@/features/inventory/ui/products-view';

export default async function InventoryProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.catalog.manage' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <ProductsView locale={locale} />
    </main>
  );
}
