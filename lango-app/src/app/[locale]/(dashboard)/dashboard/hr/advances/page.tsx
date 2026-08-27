import { SalaryAdvancesView } from '@/features/workforce/ui/salary-advances-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HrAdvancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hr.manage' });
  return <SalaryAdvancesView />;
}
