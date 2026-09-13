import { LeaveManagementClient } from '@/features/workforce/ui/leave-management-client';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function WorkforceLeavePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.leave.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LeaveManagementClient />
    </main>
  );
}
