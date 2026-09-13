import { requireLibrarySelfPage } from '@/features/library/ui/page-guard';
import { LibrarySelfServiceClient } from '@/features/library/ui/library-self-service-client';

export default async function LibrarySelfServicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibrarySelfPage(locale);
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibrarySelfServiceClient />
    </main>
  );
}
