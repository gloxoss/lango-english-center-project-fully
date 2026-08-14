import { AwardsRecognitionClient } from './awards-recognition-client';

export async function AwardsRecognitionPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches awards and recognition nominations server-side
  void locale;
  return <AwardsRecognitionClient />;
}
