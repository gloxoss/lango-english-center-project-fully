import { LibraryCatalogPage } from './library-catalog-page';

export async function LibraryCatalogView({ locale }: { locale?: string } = {}) {
  return <LibraryCatalogPage locale={locale} />;
}
