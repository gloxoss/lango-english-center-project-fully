import { SalaryAdvancesView } from '@/features/workforce/ui/salary-advances-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function WorkforceSalaryAdvancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'accountant'], requiredCapability: 'payroll.advances.manage' });
  return <SalaryAdvancesView />;
}
