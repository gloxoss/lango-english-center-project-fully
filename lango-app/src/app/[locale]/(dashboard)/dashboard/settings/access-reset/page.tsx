import { requireServerPage } from '@/libs/api/page-guard';
import { AccessResetView } from '@/features/settings/ui/access-reset-view';

export default async function AccessResetPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AccessResetView />;
}
