import { requireServerPage } from '@/libs/api/page-guard';
import { SecuritySessionsView } from '@/features/settings/ui/security-sessions-view';

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <SecuritySessionsView locale={locale} />;
}
