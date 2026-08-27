import { requireServerPage } from '@/libs/api/page-guard';
import { MilestoneTriggersView } from '@/features/crm/ui/milestone-triggers-view';

export default async function MilestoneTriggersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  return <MilestoneTriggersView locale={locale} />;
}
