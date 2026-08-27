import { EmployeeWizardView } from '@/features/hr/ui/employee-wizard-view';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Nouvel employé — SchoolOS',
  description: 'Créer un dossier employé (identité, emploi, données sensibles).',
};

export default async function HrEmployeeNewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hr.manage' });
  return <EmployeeWizardView />;
}
