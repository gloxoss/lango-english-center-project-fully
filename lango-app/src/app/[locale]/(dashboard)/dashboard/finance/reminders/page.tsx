import { requireServerPage } from '@/libs/api/page-guard';
import { RemindersStatementsView } from '@/features/finance/ui/reminders-statements-view';

// Finance reminders — server-guarded. Only `school_admin`/`accountant` roles
// with the finance.manage capability may reach this page.
export default async function RemindersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.manage' });
  return <RemindersStatementsView />;
}
