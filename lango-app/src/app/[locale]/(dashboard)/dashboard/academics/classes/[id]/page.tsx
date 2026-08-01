import { ClassDetail360View } from '@/features/academics/ui/class-detail-view';

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return <ClassDetail360View id={id} locale={locale} />;
}
