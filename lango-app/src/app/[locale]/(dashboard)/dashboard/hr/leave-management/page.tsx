import { LeaveManagementView } from '@/features/workforce/ui/leave-management-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function LeaveManagementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <LeaveManagementView />;
}
