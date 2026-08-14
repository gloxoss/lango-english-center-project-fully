import { AdmissionRequestsPage } from './admission-requests-page';

export async function AdmissionRequestsView({ locale }: { locale?: string } = {}) {
  return <AdmissionRequestsPage locale={locale} />;
}
