import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryTaxonomyClient } from '@/features/library/ui/library-taxonomy-client';

export default async function LibraryTaxonomyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { capability: 'library.catalog.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibraryTaxonomyClient />
    </main>
  );
}
