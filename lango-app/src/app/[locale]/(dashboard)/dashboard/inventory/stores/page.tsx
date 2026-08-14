import { requireServerPage } from '@/libs/api/page-guard';
import { StoresView } from '@/features/inventory/ui/stores-view';

export const metadata = {
  title: 'Magasins — SchoolOS',
  description: 'Lieux de stockage de l\'établissement.',
};

export default async function InventoryStoresPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <StoresView />;
}
