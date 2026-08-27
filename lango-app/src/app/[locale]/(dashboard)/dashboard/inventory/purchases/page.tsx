import { requireServerPage } from '@/libs/api/page-guard';
import { PurchasesView } from '@/features/inventory/ui/purchases-view';

export const metadata = {
  title: 'Achats — SchoolOS',
  description: 'Commandes fournisseur, réceptions et suivi des paiements.',
};

export default async function InventoryPurchasesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.purchase.manage' });
  return <PurchasesView />;
}
