import { AttendancePage } from './attendance-page';

export async function AttendanceView({
  locale,
  slotId,
  date,
  mode,
}: { locale?: string; slotId?: string; date?: string; mode?: 'scan' | 'manual' } = {}) {
  return <AttendancePage locale={locale} slotId={slotId} date={date} mode={mode} />;
}
