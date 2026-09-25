import { AttendancePage } from './attendance-page';

export async function AttendanceView({
  locale,
  slotId,
  date,
}: { locale?: string; slotId?: string; date?: string } = {}) {
  return <AttendancePage locale={locale} slotId={slotId} date={date} />;
}
