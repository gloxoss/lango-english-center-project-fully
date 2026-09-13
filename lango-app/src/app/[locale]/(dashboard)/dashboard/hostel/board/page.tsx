import { BedBoardView } from '@/features/hostel/ui/bed-board-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function BedBoardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <BedBoardView />
    </main>
  );
}
