import { requireServerPage } from '@/libs/api/page-guard';
import { MyRunsView } from '@/addons/advanced-reporting/ui/my-runs-view';

export default async function MyRunsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <MyRunsView />;
}
