import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibrarianPortalClient } from '@/features/library/ui/librarian-portal-client';

export default async function LibrarianPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const context = await requireLibraryPage(locale, { capability: 'library.report.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibrarianPortalClient viewingRole={context.role} />
    </main>
  );
}
