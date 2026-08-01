import { ConflictsView } from '@/features/academics/ui/conflicts-view';

export default async function ScheduleConflictsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ConflictsView locale={locale} />;
}
