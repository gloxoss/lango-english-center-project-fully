import { StudentTransfersClient } from './student-transfers-client';

export async function StudentTransfersPage({ locale }: { locale?: string } = {}) {
  return <StudentTransfersClient locale={locale} />;
}
