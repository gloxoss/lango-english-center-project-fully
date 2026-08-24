import { StudentTransfersPlayground } from './student-transfers-playground';

export async function StudentTransfersPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches transfers & promotion capacity metrics server-side
  return <StudentTransfersPlayground locale={locale} />;
}
