import { StudentTransfersPage } from './student-transfers-page';

export async function StudentTransfersView({ locale }: { locale?: string } = {}) {
  return <StudentTransfersPage locale={locale} />;
}
