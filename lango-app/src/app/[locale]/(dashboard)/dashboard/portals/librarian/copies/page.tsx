import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryCopiesClient } from '@/features/library/ui/library-copies-client';

export default async function LibrarianCopiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { allowedRoles: ['librarian', 'school_admin', 'super_admin'], capability: 'library.copy.manage' });
  return <LibraryCopiesClient />;
}
