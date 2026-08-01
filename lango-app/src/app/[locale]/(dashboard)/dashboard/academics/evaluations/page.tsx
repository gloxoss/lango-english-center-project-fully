import { EvaluationsView } from '@/features/academics/ui/evaluations-view';

export default async function EvaluationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <EvaluationsView locale={locale} />;
}
