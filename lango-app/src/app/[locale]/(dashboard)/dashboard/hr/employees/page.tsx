import { PersonnelPlayground } from '@/features/hr/ui/personnel-playground';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Employés — SchoolOS',
  description: 'Annuaire du personnel, contrats et affectations.',
};

export default async function HrEmployeesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hr.manage' });
  return <PersonnelPlayground locale={locale} />;
}
