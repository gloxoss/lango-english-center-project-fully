import { requireServerPage } from '@/libs/api/page-guard';
import CertificateDefinitionDesignerPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const p = await params;
  await requireServerPage(p.locale, { requiredCapability: 'certificates.templates.manage' });
  const isRtl = p.locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={p.locale}>
      <CertificateDefinitionDesignerPage params={p} />
    </main>
  );
}
