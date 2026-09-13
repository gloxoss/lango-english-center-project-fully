import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryCopiesClient } from '@/features/library/ui/library-copies-client';

export default async function LibrarianCopiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { capability: 'library.copy.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibraryCopiesClient />
    </main>
  );
}
