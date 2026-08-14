import { LeaveManagementPage } from './leave-management-page';

export async function LeaveManagementView({ locale }: { locale?: string } = {}) {
  return <LeaveManagementPage locale={locale} />;
}
