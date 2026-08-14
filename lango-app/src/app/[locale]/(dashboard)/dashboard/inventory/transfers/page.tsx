import { requireServerPage } from '@/libs/api/page-guard';
import { TransfersView } from '@/features/inventory/ui/transfers-view';

export const metadata = {
  title: 'Transferts de stock — SchoolOS',
  description: 'Déplacements de stock entre magasins.',
};

export default async function InventoryTransfersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <TransfersView />;
}
