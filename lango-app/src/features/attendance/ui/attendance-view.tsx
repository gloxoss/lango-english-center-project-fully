import { AttendancePage } from './attendance-page';

export async function AttendanceView({ locale }: { locale?: string } = {}) {
  return <AttendancePage locale={locale} />;
}
