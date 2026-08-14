import { requireLivePage } from '@/features/live-classrooms/ui/page-guard';
import { ReportsView } from '@/features/live-classrooms/ui/reports-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function LiveClassReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['teacher', 'school_admin', 'super_admin'] });
  await requireLivePage(locale, {
    allowedRoles: ['school_admin', 'super_admin', 'teacher'],
    requiredCapability: 'live.reports.read',
  });
  return <ReportsView />;
}
