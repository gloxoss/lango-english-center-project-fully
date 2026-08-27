import { DepartmentsView } from '@/features/hr/ui/departments-view';
import { requireServerPage } from '@/libs/api/page-guard';

export const metadata = {
  title: 'Départements — SchoolOS',
  description: 'Structure organisationnelle : départements de l\'établissement.',
};

export default async function HrDepartmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hr.organization.manage' });
  return <DepartmentsView />;
}
