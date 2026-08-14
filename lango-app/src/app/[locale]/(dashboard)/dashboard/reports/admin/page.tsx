import { requireServerPage } from '@/libs/api/page-guard';
import { ReportingAdminView } from '@/addons/advanced-reporting/ui/reporting-admin-view';

export default async function ReportingAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ReportingAdminView />;
}
