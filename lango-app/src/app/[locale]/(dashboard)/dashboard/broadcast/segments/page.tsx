import { requireServerPage } from '@/libs/api/page-guard';
import { SegmentsView } from '@/features/broadcast/ui/segments-view';

export const metadata = {
  title: 'Segments d’audience — SchoolOS',
  description: 'Gestion des segments et filtres d’audience pour les campagnes.',
};

export default async function BroadcastSegmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale} className="mx-auto max-w-7xl px-4 py-8">
      <SegmentsView />
    </main>
  );
}
