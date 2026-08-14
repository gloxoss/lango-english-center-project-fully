import { DeliveryReportsClient } from './delivery-reports-client';

export async function DeliveryReportsPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches delivery reports server-side
  return <DeliveryReportsClient locale={locale} />;
}
