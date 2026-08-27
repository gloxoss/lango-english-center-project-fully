import { requireServerPage } from '@/libs/api/page-guard';
import { IssuesView } from '@/features/inventory/ui/issues-view';

export const metadata = {
  title: 'Prêts & sorties — SchoolOS',
  description: 'Équipement prêté, retours, pertes et dommages.',
};

export default async function InventoryIssuesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'inventory.issue.manage' });
  return <IssuesView />;
}
