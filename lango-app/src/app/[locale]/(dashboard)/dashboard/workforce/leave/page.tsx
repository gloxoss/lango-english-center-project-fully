import { LeaveManagementClient } from '@/features/workforce/ui/leave-management-client';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function WorkforceLeavePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'accountant'], requiredCapability: 'payroll.leave.manage' });
  return <LeaveManagementClient />;
}
