import { AwardsRecognitionView } from '@/features/workforce/ui/awards-recognition-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AwardsRecognitionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AwardsRecognitionView />;
}
