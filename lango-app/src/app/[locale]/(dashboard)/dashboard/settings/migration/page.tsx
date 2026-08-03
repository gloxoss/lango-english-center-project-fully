import { MigrationReadinessCenterView } from '@/features/settings/ui/pf-01-migration-readiness-view';

export default async function MigrationReadinessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <MigrationReadinessCenterView locale={locale} />;
}
