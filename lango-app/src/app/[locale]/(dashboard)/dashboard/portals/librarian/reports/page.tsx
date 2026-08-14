import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryReportsClient } from '@/features/library/ui/library-reports-client';

export default async function LibrarianReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { allowedRoles: ['librarian', 'school_admin', 'super_admin'], capability: 'library.report.read' });
  return <LibraryReportsClient />;
}
