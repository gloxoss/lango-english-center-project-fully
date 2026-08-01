import { SemestersView } from '@/features/academics/ui/semesters-view';

export default async function SemestersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SemestersView locale={locale} />;
}
