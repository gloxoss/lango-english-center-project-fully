import { LibraryCatalogView } from '@/features/library/ui/library-catalog-view';
import { requireLibraryPage } from '@/features/library/ui/page-guard';

export default async function LibraryCatalogPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireLibraryPage(locale, { capability: 'library.catalog.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibraryCatalogView locale={locale} />
    </main>
  );
}
