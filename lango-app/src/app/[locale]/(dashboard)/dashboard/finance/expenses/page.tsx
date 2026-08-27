import { ExpensesManagementView } from '@/features/finance/ui/expenses-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.read' });
  return <ExpensesManagementView />;
}
