import { requireServerPage } from '@/libs/api/page-guard';
import { SubscriptionOverviewView } from '@/features/subscriptions/ui/subscription-overview-view';

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.organization.manage' });
  return <SubscriptionOverviewView locale={locale} />;
}
