import { LeavePassesView } from '@/features/hostel/ui/leave-passes-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function LeavePassesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <LeavePassesView />;
}
