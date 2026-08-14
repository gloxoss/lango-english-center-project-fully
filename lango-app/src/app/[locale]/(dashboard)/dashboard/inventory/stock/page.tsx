import { requireServerPage } from '@/libs/api/page-guard';
import { StockView } from '@/features/inventory/ui/stock-view';

export const metadata = {
  title: 'Stock — SchoolOS',
  description: 'Soldes de stock par produit et magasin, et journal des mouvements.',
};

export default async function InventoryStockPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <StockView />;
}
