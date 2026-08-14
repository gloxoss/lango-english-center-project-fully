import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryStocktakeClient } from '@/features/library/ui/library-stocktake-client';

export default async function LibrarianStocktakePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { allowedRoles: ['librarian', 'school_admin', 'super_admin'], capability: 'library.stocktake.manage' });
  return <LibraryStocktakeClient />;
}
