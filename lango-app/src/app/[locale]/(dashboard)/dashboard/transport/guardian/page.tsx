import { requireServerPage } from '@/libs/api/page-guard';
import GuardianTransportPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['parent'] });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardianTransportPage />
    </main>
  );
}
