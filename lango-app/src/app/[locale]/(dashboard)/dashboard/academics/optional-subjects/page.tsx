import { OptionalSubjectsView } from '@/features/academics/ui/optional-subjects-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function OptionalSubjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  return <OptionalSubjectsView />;
}
