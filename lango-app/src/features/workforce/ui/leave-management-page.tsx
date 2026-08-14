import { LeaveManagementClient } from './leave-management-client';

export async function LeaveManagementPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches leave management records server-side
  void locale;
  return <LeaveManagementClient />;
}
