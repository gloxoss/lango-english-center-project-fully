import { RoomsView } from '@/features/academics/ui/rooms-view';

export default async function RoomsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <RoomsView locale={locale} />;
}
