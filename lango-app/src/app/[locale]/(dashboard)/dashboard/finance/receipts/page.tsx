import { ReceiptsFinanceView } from '@/features/finance/ui/receipts-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ReceiptsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.read' });
  return <ReceiptsFinanceView locale={locale} />;
}
