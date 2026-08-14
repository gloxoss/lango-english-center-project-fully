import { EmployeeDirectoryView } from '@/features/hr/ui/employee-directory-view';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Employés — SchoolOS',
  description: 'Annuaire du personnel, contrats et affectations.',
};

export default async function HrEmployeesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <EmployeeDirectoryView />;
}
