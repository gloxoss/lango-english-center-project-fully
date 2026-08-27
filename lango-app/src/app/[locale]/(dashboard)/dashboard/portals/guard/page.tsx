import { requireServerPage } from '@/libs/api/page-guard';
import { GuardHomeView } from '@/features/guard/ui/guard-home-view';

export default async function GuardPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'guard.portal.use' });
  return <GuardHomeView />;
}
