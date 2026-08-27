import { InvoicesFinanceView } from '@/features/finance/ui/invoices-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.read' });
  return <InvoicesFinanceView locale={locale} />;
}
