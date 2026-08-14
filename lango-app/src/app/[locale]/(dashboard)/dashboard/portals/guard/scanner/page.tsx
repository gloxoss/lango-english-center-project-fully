import { requireServerPage } from '@/libs/api/page-guard';
import { GuardKioskShell } from '@/features/guard/ui/guard-kiosk-shell';

export default async function GuardScannerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, {
    allowedRoles: ['guard', 'school_admin', 'super_admin'],
    requiredCapability: 'guard.portal.use',
  });
  return <GuardKioskShell />;
}
