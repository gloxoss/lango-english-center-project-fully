import { InvoicesFinanceView } from '@/features/finance/ui/invoices-view';

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <InvoicesFinanceView locale={locale} />;
}
