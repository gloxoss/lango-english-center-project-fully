import { ExpensesManagementView } from '@/features/finance/ui/expenses-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // `finance.manage`, matching the capability /api/finance/expenses requires: with
  // `finance.read` a user reached the page and every fetch on it 403'd.
  await requireServerPage(locale, { requiredCapability: 'finance.manage' });
  return <ExpensesManagementView />;
}
