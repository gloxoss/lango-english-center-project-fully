import { requireServerPage } from '@/libs/api/page-guard';
import { SuppliersView } from '@/features/inventory/ui/suppliers-view';

export const metadata = {
  title: 'Fournisseurs — SchoolOS',
  description: 'Fournisseurs des achats et réceptions.',
};

export default async function InventorySuppliersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.catalog.manage' });
  return <SuppliersView />;
}
