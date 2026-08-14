import { EmployeeProfileView } from '@/features/hr/ui/employee-profile-view';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Dossier employé — SchoolOS',
  description: 'Détails du dossier employé, données sensibles et chronologie.',
};

export default async function HrEmployeeProfilePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <EmployeeProfileView employeeId={id} />;
}
