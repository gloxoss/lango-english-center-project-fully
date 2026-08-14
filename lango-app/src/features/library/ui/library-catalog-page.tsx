import { LibraryCatalogClient } from './library-catalog-client';

export async function LibraryCatalogPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches library catalog records server-side
  return <LibraryCatalogClient locale={locale} />;
}
