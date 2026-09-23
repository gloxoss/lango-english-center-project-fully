import { AudienceSegmentsClient } from './audience-segments-client';

export async function AudienceSegmentsPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches audience segments server-side
  return <AudienceSegmentsClient locale={locale} />;
}
