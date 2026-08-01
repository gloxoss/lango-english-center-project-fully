import { InvoiceDetailView } from '@/features/finance/ui/invoice-detail-view';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return <InvoiceDetailView locale={locale} invoiceId={id} />;
}
