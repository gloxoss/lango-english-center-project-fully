import { requireServerPage } from '@/libs/api/page-guard';
import { ReceptionHomeView } from '@/features/reception/ui/reception-home-view';

export default async function ReceptionistHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'reception.portal.use' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <ReceptionHomeView />
    </main>
  );
}
