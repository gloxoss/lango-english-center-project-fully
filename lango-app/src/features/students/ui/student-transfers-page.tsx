import { StudentTransfersClient } from './student-transfers-client';

export async function StudentTransfersPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches transfers & promotion capacity metrics server-side
  return <StudentTransfersClient locale={locale} />;
}
