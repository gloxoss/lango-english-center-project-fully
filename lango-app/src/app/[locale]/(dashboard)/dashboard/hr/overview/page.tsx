import { HrOverviewView } from '@/features/hr/ui/hr-overview-view';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Aperçu RH — SchoolOS',
  description: 'Indicateurs clés du personnel : effectif, embauches, départs, documents à expiration.',
};

export default async function HrOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <HrOverviewView />;
}
