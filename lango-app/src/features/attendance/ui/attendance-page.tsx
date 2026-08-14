import { AttendanceClient } from './attendance-client';

export async function AttendancePage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches roster & attendance registers server-side
  return <AttendanceClient locale={locale} />;
}
