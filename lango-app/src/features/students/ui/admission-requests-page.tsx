import { AdmissionRequestsClient } from './admission-requests-client';

export async function AdmissionRequestsPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches admission candidates server-side
  return <AdmissionRequestsClient locale={locale} />;
}
