import { AttendanceView } from '@/features/attendance/ui/attendance-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  await requireServerPage(locale, { requiredCapability: 'attendance.read' });

  // A session-scoped link (?slot=…&date=…) opens that exact lesson's roll call.
  // Without one the page is the day overview, which is the normal entry point.
  const slotId = typeof query.slot === 'string' ? query.slot : undefined;
  const date = typeof query.date === 'string' ? query.date : undefined;
  const mode = query.mode === 'scan' || query.mode === 'manual' ? query.mode : undefined;

  return <AttendanceView locale={locale} slotId={slotId} date={date} mode={mode} />;
}
