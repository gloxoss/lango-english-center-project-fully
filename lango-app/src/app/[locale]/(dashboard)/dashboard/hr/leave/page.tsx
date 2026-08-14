import { LeaveManagementClient } from '@/features/workforce/ui/leave-management-client';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HrLeavePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <LeaveManagementClient />;
}
