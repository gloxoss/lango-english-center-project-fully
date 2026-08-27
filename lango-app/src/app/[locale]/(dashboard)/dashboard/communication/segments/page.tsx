import { requireServerPage } from '@/libs/api/page-guard';
import { AudienceSegmentsView } from '@/features/crm/ui/audience-segments-view';

export default async function AudienceSegmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  return <AudienceSegmentsView locale={locale} />;
}
