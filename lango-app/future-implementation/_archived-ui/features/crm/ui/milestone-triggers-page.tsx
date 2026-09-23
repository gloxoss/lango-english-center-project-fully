import { MilestoneTriggersClient } from './milestone-triggers-client';

export async function MilestoneTriggersPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches milestone workflows server-side
  return <MilestoneTriggersClient locale={locale} />;
}
