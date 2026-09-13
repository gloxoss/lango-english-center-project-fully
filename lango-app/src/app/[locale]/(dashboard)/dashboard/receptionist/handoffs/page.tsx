import { requireServerPage } from '@/libs/api/page-guard';
import { ReceptionHandoffsView } from '@/features/reception/ui/reception-handoffs-view';

export default async function ReceptionistHandoffsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'reception.handoff.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <ReceptionHandoffsView />
    </main>
  );
}
