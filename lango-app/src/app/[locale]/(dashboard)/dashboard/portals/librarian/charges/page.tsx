import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryChargesClient } from '@/features/library/ui/library-charges-client';

export default async function LibrarianChargesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { capability: 'library.circulation.operate' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibraryChargesClient />
    </main>
  );
}
