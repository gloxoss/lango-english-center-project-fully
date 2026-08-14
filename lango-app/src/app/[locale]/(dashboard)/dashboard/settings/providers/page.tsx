import { requireServerPage } from '@/libs/api/page-guard';
import { ProvidersView } from '@/features/settings/ui/providers-view';

export default async function ProvidersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ProvidersView locale={locale} />;
}
