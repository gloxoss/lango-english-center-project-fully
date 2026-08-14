import { ScheduleInteractiveView } from '@/features/academics/ui/schedule-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function SchedulePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ScheduleInteractiveView />;
}
