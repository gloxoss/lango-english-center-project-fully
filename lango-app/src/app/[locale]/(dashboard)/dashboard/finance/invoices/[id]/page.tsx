import { InvoiceDetailView } from '@/features/finance/ui/invoice-detail-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireServerPage(locale, { allowedRoles: ['accountant', 'school_admin', 'super_admin'] });
  return <InvoiceDetailView locale={locale} invoiceId={id} />;
}
