import { MediumsView } from '@/features/academics/ui/mediums-view';

export default async function MediumsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <MediumsView locale={locale} />;
}
