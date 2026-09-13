import { requireServerPage } from '@/libs/api/page-guard';
import { CategoriesView } from '@/features/inventory/ui/categories-view';

export default async function InventoryCategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.catalog.manage' });
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <CategoriesView />
    </main>
  );
}
