import { DeliveryReportsPage } from './delivery-reports-page';

export async function DeliveryReportsView({ locale }: { locale?: string } = {}) {
  return <DeliveryReportsPage locale={locale} />;
}
