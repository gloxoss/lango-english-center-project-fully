import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminSubscriptionsListView } from '@/features/super-admin/ui/super-admin-subscriptions-list-view';

export default async function SuperAdminSubscriptionsListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminSubscriptionsListView />;
}
