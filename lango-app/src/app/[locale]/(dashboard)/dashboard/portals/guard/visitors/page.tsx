import { requireServerPage } from '@/libs/api/page-guard';
import { GuardVisitorsView } from '@/features/guard/ui/guard-visitors-view';

export default async function GuardVisitorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, {
    allowedRoles: ['guard', 'school_admin', 'super_admin'],
    requiredCapability: 'guard.portal.use',
  });
  return <GuardVisitorsView />;
}
