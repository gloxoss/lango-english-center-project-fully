import { EvaluationsView } from '@/features/academics/ui/evaluations-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function EvaluationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  return <EvaluationsView locale={locale} />;
}
