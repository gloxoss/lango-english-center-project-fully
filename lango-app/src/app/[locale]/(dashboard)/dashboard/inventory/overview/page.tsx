import { requireServerPage } from '@/libs/api/page-guard';
import { OverviewView } from '@/features/inventory/ui/overview-view';

export const metadata = {
  title: 'Vue d\'ensemble — SchoolOS',
  description: 'Situation de l\'inventaire : produits, stock, prêts et mouvements.',
};

export default async function InventoryOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <OverviewView />;
}
