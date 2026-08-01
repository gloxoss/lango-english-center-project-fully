import { StreamsView } from '@/features/academics/ui/streams-view';

export default async function StreamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <StreamsView locale={locale} />;
}
