import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryHoldsClient } from '@/features/library/ui/library-holds-client';

export default async function LibrarianHoldsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { capability: 'library.hold.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibraryHoldsClient />
    </main>
  );
}
