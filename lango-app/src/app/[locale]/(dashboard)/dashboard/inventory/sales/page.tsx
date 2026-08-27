import { requireServerPage } from '@/libs/api/page-guard';
import { SalesView } from '@/features/inventory/ui/sales-view';

export const metadata = {
  title: 'Ventes — SchoolOS',
  description: 'Caisse et point de vente : ventes étudiant, personnel et comptoir, avec facturation.',
};

export default async function InventorySalesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.sell' });
  return <SalesView />;
}
