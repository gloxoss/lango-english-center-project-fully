import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryTransfersClient } from '@/features/library/ui/library-transfers-client';

export default async function LibrarianTransfersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { capability: 'library.copy.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibraryTransfersClient />
    </main>
  );
}
