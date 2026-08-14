import { SalaryAdvancesClient } from './salary-advances-client';

export async function SalaryAdvancesPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches salary advance records server-side
  void locale;
  return <SalaryAdvancesClient />;
}
