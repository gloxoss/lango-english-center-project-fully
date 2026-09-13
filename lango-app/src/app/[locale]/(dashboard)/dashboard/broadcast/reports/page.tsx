import { requireServerPage } from '@/libs/api/page-guard';
import { ReportsView } from '@/features/broadcast/ui/reports-view';

export const metadata = {
  title: 'Rapports de diffusion — SchoolOS',
  description: 'Statistiques et taux de délivrabilité des campagnes de diffusion.',
};

export default async function BroadcastReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'broadcast.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale} className="mx-auto max-w-7xl px-4 py-8">
      <ReportsView />
    </main>
  );
}
