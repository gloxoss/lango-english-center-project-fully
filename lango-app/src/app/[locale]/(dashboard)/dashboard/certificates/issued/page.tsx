import { requireServerPage } from '@/libs/api/page-guard';
import CertificatesIssuedPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'certificates.issue' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <CertificatesIssuedPage />
    </main>
  );
}
