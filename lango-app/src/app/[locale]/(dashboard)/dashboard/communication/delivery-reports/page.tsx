import { requireServerPage } from '@/libs/api/page-guard';
import { DeliveryReportsView } from '@/features/crm/ui/delivery-reports-view';

export default async function DeliveryReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <DeliveryReportsView locale={locale} />;
}
