import { SecuritySessionsView } from '@/features/settings/ui/security-sessions-view';

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SecuritySessionsView locale={locale} />;
}
