import { HostelDetailView } from '@/features/hostel/ui/hostel-detail-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <HostelDetailView hostelId={id} />;
}
