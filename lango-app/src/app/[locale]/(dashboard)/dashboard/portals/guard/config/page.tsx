import { requireServerPage } from '@/libs/api/page-guard';
import { GuardConfigView } from '@/features/guard/ui/guard-config-view';

export default async function GuardConfigPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, {
    allowedRoles: ['guard', 'school_admin', 'super_admin'],
    requiredCapability: 'guard.portal.use',
  });
  return <GuardConfigView />;
}
