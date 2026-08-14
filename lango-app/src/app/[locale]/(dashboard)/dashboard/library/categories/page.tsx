import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryTaxonomyClient } from '@/features/library/ui/library-taxonomy-client';

export default async function LibraryTaxonomyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { allowedRoles: ['librarian', 'school_admin', 'super_admin'], capability: 'library.catalog.read' });
  return <LibraryTaxonomyClient />;
}
