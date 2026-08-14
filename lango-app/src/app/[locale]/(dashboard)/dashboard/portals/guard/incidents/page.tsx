import { requireServerPage } from '@/libs/api/page-guard';
import { GuardIncidentsView } from '@/features/guard/ui/guard-incidents-view';

export default async function GuardIncidentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, {
    allowedRoles: ['guard', 'school_admin', 'super_admin'],
    requiredCapability: 'guard.portal.use',
  });
  return <GuardIncidentsView />;
}
