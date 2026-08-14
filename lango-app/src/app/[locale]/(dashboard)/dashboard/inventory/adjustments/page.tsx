import { requireServerPage } from '@/libs/api/page-guard';
import { AdjustmentsView } from '@/features/inventory/ui/adjustments-view';

export const metadata = {
  title: 'Ajustements de stock — SchoolOS',
  description: 'Corrections d\'inventaire, pertes, dons et mises au rebut.',
};

export default async function InventoryAdjustmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AdjustmentsView />;
}
