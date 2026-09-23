import { requireServerPage } from '@/libs/api/page-guard';
import { AudienceSegmentsView } from '@/features/crm/ui/audience-segments-view';

export default async function AudienceSegmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <AudienceSegmentsView locale={locale} />
    </main>
  );
}
