import { ConflictsView } from '@/features/academics/ui/conflicts-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ScheduleConflictsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  return <ConflictsView locale={locale} />;
}
