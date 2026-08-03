import { ProvidersView } from '@/features/settings/ui/providers-view';

export default async function ProvidersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ProvidersView locale={locale} />;
}
