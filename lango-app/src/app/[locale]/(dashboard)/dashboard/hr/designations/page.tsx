import { DesignationsView } from '@/features/hr/ui/designations-view';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Postes & fonctions — SchoolOS',
  description: 'Référentiel des postes de l\'établissement.',
};

export default async function HrDesignationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hr.organization.manage' });
  return <DesignationsView />;
}
