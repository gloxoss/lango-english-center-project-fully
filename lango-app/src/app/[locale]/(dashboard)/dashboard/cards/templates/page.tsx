import { requireServerPage } from '@/libs/api/page-guard';
import TemplatesLibraryPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const p = await params;
  await requireServerPage(p.locale, { requiredCapability: 'cards.templates.manage' });
  const isRtl = p.locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={p.locale}>
      <TemplatesLibraryPage />
    </main>
  );
}
