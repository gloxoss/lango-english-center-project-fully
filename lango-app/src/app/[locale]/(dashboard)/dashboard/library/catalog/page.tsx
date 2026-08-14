import { LibraryCatalogView } from '@/features/library/ui/library-catalog-view';
import { requireLibraryPage } from '@/features/library/ui/page-guard';

export default async function LibraryCatalogPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireLibraryPage(locale, { allowedRoles: ['school_admin', 'super_admin', 'librarian'], capability: 'library.catalog.read' });
  return <LibraryCatalogView locale={locale} />;
}
