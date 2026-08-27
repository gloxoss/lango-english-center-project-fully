import { requireServerPage } from '@/libs/api/page-guard';
import { CategoriesView } from '@/features/inventory/ui/categories-view';

export const metadata = {
  title: 'Catégories — SchoolOS',
  description: 'Catégories de produits du catalogue d\'inventaire.',
};

export default async function InventoryCategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.catalog.manage' });
  return <CategoriesView />;
}
