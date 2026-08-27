import { CreditNotesView } from '@/features/finance/ui/credit-notes-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function CreditNotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.manage' });
  return <CreditNotesView />;
}
