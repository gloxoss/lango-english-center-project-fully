import { requireServerPage } from '@/libs/api/page-guard';
import { ProductsView } from '@/features/inventory/ui/products-view';

export const metadata = {
  title: 'Produits — SchoolOS',
  description: 'Catalogue des produits : prix, unités, catégories et stock par magasin.',
};

export default async function InventoryProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ProductsView />;
}
