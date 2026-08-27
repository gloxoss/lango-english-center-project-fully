import { requireServerPage } from '@/libs/api/page-guard';
import { SchoolOnboardingView } from '@/features/settings/ui/school-onboarding-view';

export default async function SchoolOnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.organization.manage' });
  return <SchoolOnboardingView />;
}
