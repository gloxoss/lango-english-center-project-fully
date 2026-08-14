import { MilestoneTriggersPage } from './milestone-triggers-page';

export async function MilestoneTriggersView({ locale }: { locale?: string } = {}) {
  return <MilestoneTriggersPage locale={locale} />;
}
