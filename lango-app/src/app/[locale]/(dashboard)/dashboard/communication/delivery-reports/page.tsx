import { requireServerPage } from '@/libs/api/page-guard';
import { DeliveryReportsView } from '@/features/crm/ui/delivery-reports-view';

export default async function DeliveryReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <DeliveryReportsView locale={locale} />
    </main>
  );
}
