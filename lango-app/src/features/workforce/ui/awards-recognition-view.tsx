import { AwardsRecognitionPage } from './awards-recognition-page';

export async function AwardsRecognitionView({ locale }: { locale?: string } = {}) {
  return <AwardsRecognitionPage locale={locale} />;
}
