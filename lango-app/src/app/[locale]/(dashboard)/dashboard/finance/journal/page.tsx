import { JournalExplorerView } from '@/features/finance/ui/journal-explorer-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'accounting.journal.create' });
  return <JournalExplorerView />;
}
