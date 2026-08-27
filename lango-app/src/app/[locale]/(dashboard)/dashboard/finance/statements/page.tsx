import { StatementsFinanceView } from '@/features/finance/ui/statements-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function StatementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'accounting.statement.read' });
  return <StatementsFinanceView locale={locale} />;
}
