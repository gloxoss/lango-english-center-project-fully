import { AudienceSegmentsPage } from './audience-segments-page';

export async function AudienceSegmentsView({ locale }: { locale?: string } = {}) {
  return <AudienceSegmentsPage locale={locale} />;
}
