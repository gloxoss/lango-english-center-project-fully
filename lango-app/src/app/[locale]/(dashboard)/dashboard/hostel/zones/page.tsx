import { ZonesView } from '@/features/hostel/ui/zones-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ZonesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ZonesView />;
}
