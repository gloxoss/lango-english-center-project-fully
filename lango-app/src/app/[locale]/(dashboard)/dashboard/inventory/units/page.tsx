import { requireServerPage } from '@/libs/api/page-guard';
import { UnitsView } from '@/features/inventory/ui/units-view';

export const metadata = {
  title: 'Unités — SchoolOS',
  description: 'Unités de mesure pour les achats et les ventes.',
};

export default async function InventoryUnitsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <UnitsView />;
}
