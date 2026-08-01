import { SectionsView } from '@/features/academics/ui/sections-view';

export default async function SectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SectionsView locale={locale} />;
}
