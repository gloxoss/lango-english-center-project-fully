import { PoliciesView } from '@/features/settings/ui/policies-view';

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PoliciesView locale={locale} />;
}
