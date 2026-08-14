import { requireServerPage } from '@/libs/api/page-guard';
import { CndpComplianceView } from '@/features/settings/ui/cndp-view';

export default async function CndpSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <CndpComplianceView />;
}
