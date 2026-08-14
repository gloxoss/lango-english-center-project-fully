import { RoomsView } from '@/features/academics/ui/rooms-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function RoomsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <RoomsView locale={locale} />;
}
