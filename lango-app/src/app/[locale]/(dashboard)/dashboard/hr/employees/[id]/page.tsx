import { EmployeeProfileView } from '@/features/hr/ui/employee-profile-view';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Dossier employé — SchoolOS',
  description: 'Détails du dossier employé, données sensibles et chronologie.',
};

export default async function HrEmployeeProfilePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireServerPage(locale, { requiredCapability: 'hr.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <EmployeeProfileView employeeId={id} />
    </main>
  );
}
