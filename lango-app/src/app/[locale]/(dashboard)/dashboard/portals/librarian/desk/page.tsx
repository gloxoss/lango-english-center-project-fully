import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibrarianPortalClient } from '@/features/library/ui/librarian-portal-client';

export default async function LibrarianDeskPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const context = await requireLibraryPage(locale, { capability: 'library.circulation.operate' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibrarianPortalClient desk viewingRole={context.role} />
    </main>
  );
}
