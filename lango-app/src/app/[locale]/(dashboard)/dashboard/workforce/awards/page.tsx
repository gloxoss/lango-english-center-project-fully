import { AwardsRecognitionClient } from '@/features/workforce/ui/awards-recognition-client';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function WorkforceAwardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.awards.manage' });
  return <AwardsRecognitionClient />;
}
