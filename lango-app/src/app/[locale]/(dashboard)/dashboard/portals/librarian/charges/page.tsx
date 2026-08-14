import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryChargesClient } from '@/features/library/ui/library-charges-client';

export default async function LibrarianChargesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { allowedRoles: ['librarian', 'school_admin', 'super_admin'], capability: 'library.circulation.operate' });
  return <LibraryChargesClient />;
}
