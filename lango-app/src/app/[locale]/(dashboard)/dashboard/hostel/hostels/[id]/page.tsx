import { HostelDetailView } from '@/features/hostel/ui/hostel-detail-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.manage' });
  return <HostelDetailView hostelId={id} />;
}
