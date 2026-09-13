import { AwardsRecognitionClient } from '@/features/workforce/ui/awards-recognition-client';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function WorkforceAwardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.awards.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <AwardsRecognitionClient />
    </main>
  );
}
