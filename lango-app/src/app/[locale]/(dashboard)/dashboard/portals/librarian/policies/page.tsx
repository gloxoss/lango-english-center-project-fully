import { requireLibraryPage } from '@/features/library/ui/page-guard';
import { LibraryPoliciesClient } from '@/features/library/ui/library-policies-client';

export default async function LibrarianPoliciesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibraryPage(locale, { capability: 'library.policy.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LibraryPoliciesClient />
    </main>
  );
}
