import { EmployeePortalView } from '@/features/hr/ui/employee-portal-view';
import { redirect } from 'next/navigation';
import { getServerUserContext } from '@/libs/auth/server-context';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

export const metadata = {
  title: 'Portail Employé — SchoolOS',
  description: 'Gérez votre planning, vos présences, vos congés, vos fiches de paie et vos documents personnels.',
};

export default async function HrSelfServicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getServerUserContext();
  if (!ctx?.tenantId) redirect(`/${locale}/login`);
  try {
    await resolveEmployeeContext(ctx.tenantId, ctx.userId, { allowRetainedReadOnly: true });
  } catch {
    // Not an employee (or no retained read-only record): bounce back into the
    // app, not out to the public marketing homepage. Carry a notice so the
    // landing page can explain why instead of dropping the user silently.
    redirect(`/${locale}/dashboard?notice=employee_portal_unavailable`);
  }
  return <EmployeePortalView />;
}
