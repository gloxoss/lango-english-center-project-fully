import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryCatalogDetailClient } from '@/features/library/ui/library-catalog-detail-client';

export default async function LibraryCatalogDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await props.params;
  await requireLibraryPage(locale, { allowedRoles: ['school_admin', 'super_admin', 'librarian'], capability: 'library.catalog.read' });
  return <LibraryCatalogDetailClient recordId={id} />;
}
