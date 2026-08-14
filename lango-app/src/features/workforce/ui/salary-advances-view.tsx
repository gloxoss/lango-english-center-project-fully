import { SalaryAdvancesPage } from './salary-advances-page';

export async function SalaryAdvancesView({ locale }: { locale?: string } = {}) {
  return <SalaryAdvancesPage locale={locale} />;
}
