import { requireServerPage } from '@/libs/api/page-guard';
import { SegmentsView } from '@/features/broadcast/ui/segments-view';

export const metadata = {
  title: 'Segments d’audience — SchoolOS',
  description: 'Segments de diffusion : audiences ciblées et recalcul en direct.',
};

export default async function BroadcastSegmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SegmentsView />
    </div>
  );
}
