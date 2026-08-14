import { SalaryAdvancesView } from '@/features/workforce/ui/salary-advances-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function SalaryAdvancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <SalaryAdvancesView />;
}
