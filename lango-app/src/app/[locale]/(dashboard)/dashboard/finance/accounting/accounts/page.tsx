import { ChartOfAccountsView } from '@/features/finance/ui/chart-of-accounts-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['accountant', 'school_admin', 'super_admin'], requiredCapability: 'accounting.account.read' });
  return <ChartOfAccountsView locale={locale} />;
}
